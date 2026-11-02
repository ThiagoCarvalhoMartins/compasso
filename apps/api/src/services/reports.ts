import PDFDocument from "pdfkit";
import {
  addDays,
  ageGroup,
  ageOn,
  blocksForDate,
  dateRange,
  QP_DURATIONS,
} from "@compasso/shared";
import { toBlockDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { fromDbDate, toDbDate, todayIn } from "../lib/time";

/** Datas de referência do painel no fuso de Brasília. */
const PANEL_TZ = "America/Sao_Paulo";
const today = () => todayIn(PANEL_TZ);
const utcDay = (d: Date) => todayIn(PANEL_TZ, d);

/** Taxa de cumprimento: blocos marcados como concluídos ÷ blocos previstos no período (até ontem). */
async function completionRate(from: string, to: string, userIds?: string[]) {
  const where = { user: { status: { not: "DELETED" as const } }, ...(userIds ? { userId: { in: userIds } } : {}) };
  const blocks = (await prisma.block.findMany({ where, include: { user: { select: { createdAt: true } } } })).map((b) => ({
    ...toBlockDTO(b),
    userCreated: utcDay(b.user.createdAt),
  }));
  const perDay = new Map<string, { planned: number; done: number }>();
  for (const date of dateRange(from, to)) {
    const planned = blocksForDate(blocks, date).filter((b) => b.userCreated <= date).length;
    perDay.set(date, { planned, done: 0 });
  }
  const done = await prisma.blockLog.groupBy({
    by: ["date"],
    where: { status: "DONE", date: { gte: toDbDate(from), lte: toDbDate(to) }, ...(userIds ? { userId: { in: userIds } } : {}) },
    _count: true,
  });
  for (const row of done) {
    const day = perDay.get(fromDbDate(row.date));
    if (day) day.done = row._count;
  }
  return perDay;
}

async function activeUsers(fromDate: string, toDate: string): Promise<number> {
  const rows = await prisma.userActivity.groupBy({
    by: ["userId"],
    where: { date: { gte: toDbDate(fromDate), lte: toDbDate(toDate) } },
  });
  return rows.length;
}

/** RF08 — indicadores do dashboard. */
export async function dashboard() {
  const now = new Date();
  const t0 = today();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const base = { role: "USER" as const, status: { not: "DELETED" as const } };

  const [total, newDay, newWeek, newMonth, dau, wau, mau] = await Promise.all([
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, createdAt: { gte: daysAgo(1) } } }),
    prisma.user.count({ where: { ...base, createdAt: { gte: daysAgo(7) } } }),
    prisma.user.count({ where: { ...base, createdAt: { gte: daysAgo(30) } } }),
    activeUsers(t0, t0),
    activeUsers(addDays(t0, -6), t0),
    activeUsers(addDays(t0, -29), t0),
  ]);

  // Retenção: dos usuários cadastrados nos últimos 90 dias há pelo menos N dias, quantos voltaram no dia N ou depois.
  const cohort = await prisma.user.findMany({
    where: { ...base, createdAt: { gte: daysAgo(90) } },
    select: { id: true, createdAt: true, activity: { select: { date: true } } },
  });
  const retention = Object.fromEntries(
    [1, 7, 30].map((n) => {
      const eligible = cohort.filter((u) => addDays(utcDay(u.createdAt), n) <= t0);
      const back = eligible.filter((u) => u.activity.some((a) => fromDbDate(a.date) >= addDays(utcDay(u.createdAt), n)));
      return [`d${n}`, eligible.length ? back.length / eligible.length : null];
    }),
  );

  const yesterday = addDays(t0, -1);
  const completion = await completionRate(addDays(t0, -30), yesterday);
  const totals = [...completion.values()].reduce((acc, d) => ({ planned: acc.planned + d.planned, done: acc.done + d.done }), { planned: 0, done: 0 });

  const qpSessions = await prisma.qpSession.findMany({
    where: { completed: true, startedAt: { gte: daysAgo(30) } },
    select: { startedAt: true, plannedSeconds: true },
  });
  const qpPerDay = dateRange(addDays(t0, -29), t0).map((date) => ({
    date,
    count: qpSessions.filter((s) => utcDay(s.startedAt) === date).length,
  }));
  const durationCounts = QP_DURATIONS.map((seconds) => ({
    seconds,
    count: qpSessions.filter((s) => s.plannedSeconds === seconds).length,
  }));
  const mostChosen = durationCounts.reduce((best, d) => (d.count > best.count ? d : best));

  const [googleUsers, users] = await Promise.all([
    prisma.user.count({ where: { ...base, googleId: { not: null } } }),
    prisma.user.findMany({ where: base, select: { birthDate: true } }),
  ]);
  const ages = new Map<string, number>();
  for (const u of users) {
    if (!u.birthDate) continue;
    const group = ageGroup(ageOn(fromDbDate(u.birthDate), t0));
    ages.set(group, (ages.get(group) ?? 0) + 1);
  }

  return {
    users: { total, newDay, newWeek, newMonth },
    active: { dau, wau, mau },
    retention,
    completion: { ...totals, rate: totals.planned ? totals.done / totals.planned : null },
    qp: {
      perDay: qpPerDay,
      averagePerActiveUser: mau ? qpSessions.length / mau : 0,
      mostChosenSeconds: mostChosen.count ? mostChosen.seconds : null,
      durations: durationCounts,
    },
    loginType: { google: googleUsers, email: total - googleUsers },
    ageGroups: [...ages.entries()].map(([group, count]) => ({ group, count })).sort((a, b) => a.group.localeCompare(b.group)),
  };
}

/** Ids dos usuários de uma faixa etária (RF09.3). */
async function usersInAgeGroup(group?: string): Promise<string[] | undefined> {
  if (!group) return undefined;
  const t0 = today();
  const users = await prisma.user.findMany({ where: { birthDate: { not: null } }, select: { id: true, birthDate: true } });
  return users.filter((u) => ageGroup(ageOn(fromDbDate(u.birthDate!), t0)) === group).map((u) => u.id);
}

export type ReportRow = Record<string, string | number>;

/** RF09.1 / RF09.2 — só dados agregados, sem conteúdo dos blocos (RF09.5). */
export async function buildReport(type: "cadastros" | "engajamento", from: string, to: string, group?: string): Promise<ReportRow[]> {
  const ids = await usersInAgeGroup(group);
  const idFilter = ids ? { id: { in: ids } } : {};
  const userIdFilter = ids ? { userId: { in: ids } } : {};
  const days = dateRange(from, to);
  const range = { gte: toDbDate(from), lt: toDbDate(addDays(to, 1)) };

  if (type === "cadastros") {
    const users = await prisma.user.findMany({
      where: { role: "USER", createdAt: range, ...idFilter },
      select: { createdAt: true, googleId: true },
    });
    return days.map((date) => {
      const ofDay = users.filter((u) => utcDay(u.createdAt) === date);
      const google = ofDay.filter((u) => u.googleId).length;
      return { data: date, cadastros: ofDay.length, email: ofDay.length - google, google };
    });
  }

  const [activity, blocks, qp, completion] = await Promise.all([
    prisma.userActivity.findMany({ where: { date: { gte: toDbDate(from), lte: toDbDate(to) }, ...userIdFilter }, select: { date: true } }),
    prisma.block.findMany({ where: { createdAt: range, ...userIdFilter }, select: { createdAt: true } }),
    prisma.qpSession.findMany({ where: { startedAt: range, completed: true, ...userIdFilter }, select: { startedAt: true } }),
    completionRate(from, to, ids),
  ]);
  return days.map((date) => {
    const c = completion.get(date)!;
    return {
      data: date,
      ativos: activity.filter((a) => fromDbDate(a.date) === date).length,
      blocos_criados: blocks.filter((b) => utcDay(b.createdAt) === date).length,
      blocos_previstos: c.planned,
      blocos_concluidos: c.done,
      cumprimento: c.planned ? `${Math.round((c.done / c.planned) * 100)}%` : "—",
      repeticoes_qp: qp.filter((s) => utcDay(s.startedAt) === date).length,
    };
  });
}

export function toCsv(rows: ReportRow[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return "﻿" + [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))].join("\n");
}

export function toPdf(title: string, rows: ReportRow[]): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.fillColor("#3D3A36").fontSize(18).text(title);
    doc.moveDown(0.3).fontSize(9).fillColor("#8A847B").text(`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: PANEL_TZ })}`);
    doc.moveDown();
    if (rows.length) {
      const headers = Object.keys(rows[0]);
      const colWidth = (doc.page.width - 80) / headers.length;
      const drawRow = (values: string[], bold = false) => {
        const y = doc.y;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor("#3D3A36");
        values.forEach((v, i) => doc.text(v, 40 + i * colWidth, y, { width: colWidth - 6 }));
        doc.moveDown(0.4);
        if (doc.y > doc.page.height - 50) doc.addPage();
      };
      drawRow(headers.map((h) => h.replace(/_/g, " ")), true);
      rows.forEach((r) => drawRow(headers.map((h) => String(r[h]))));
    }
    doc.end();
  });
}
