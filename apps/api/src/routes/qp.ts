import { Router } from "express";
import { dateRange, qpEndSchema, qpStartSchema, rangeQuerySchema, type QpSummaryDay } from "@compasso/shared";
import { badRequest, notFound, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { dayBoundsUtc, todayIn } from "../lib/time";
import { userId } from "../middleware/auth";

export const qpRouter = Router();

// RF05.1 / RF05.2 — inicia a sessão e lembra a duração escolhida
qpRouter.post("/", async (req, res) => {
  const id = userId(req);
  const { plannedSeconds } = parse(qpStartSchema, req.body);
  const [session] = await prisma.$transaction([
    prisma.qpSession.create({ data: { userId: id, plannedSeconds, startedAt: new Date() } }),
    prisma.userSettings.upsert({
      where: { userId: id },
      update: { qpDurationSeconds: plannedSeconds },
      create: { userId: id, qpDurationSeconds: plannedSeconds },
    }),
  ]);
  res.status(201).json({ id: session.id, startedAt: session.startedAt, plannedSeconds });
});

// RF05.4 / RN11 — encerrada antes do fim = incompleta
qpRouter.patch("/:id", async (req, res) => {
  const { actualSeconds } = parse(qpEndSchema, req.body);
  const session = await prisma.qpSession.findFirst({ where: { id: req.params.id, userId: userId(req) } });
  if (!session) throw notFound();
  if (session.endedAt) throw badRequest("Sessão já encerrada.");
  const actual = Math.min(actualSeconds, session.plannedSeconds);
  const updated = await prisma.qpSession.update({
    where: { id: session.id },
    data: { endedAt: new Date(), actualSeconds: actual, completed: actual >= session.plannedSeconds },
  });
  res.json({ id: updated.id, completed: updated.completed, actualSeconds: updated.actualSeconds });
});

// RF05.6 / RF05.7 / RN12 — repetições por dia, contadas no fuso do usuário
qpRouter.get("/summary", async (req, res) => {
  const id = userId(req);
  const { from, to } = parse(rangeQuerySchema, req.query);
  if (to < from) throw badRequest("Período inválido.");
  const days = dateRange(from, to);
  if (days.length > 92) throw badRequest("Período máximo de 92 dias.");

  const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } });
  const sessions = await prisma.qpSession.findMany({
    where: {
      userId: id,
      endedAt: { not: null },
      startedAt: { gte: dayBoundsUtc(from, timezone).start, lt: dayBoundsUtc(to, timezone).end },
    },
    select: { startedAt: true, completed: true },
  });

  const summary = new Map<string, QpSummaryDay>(days.map((date) => [date, { date, completed: 0, incomplete: 0 }]));
  for (const s of sessions) {
    const day = summary.get(todayIn(timezone, s.startedAt));
    if (day) s.completed ? day.completed++ : day.incomplete++;
  }
  res.json([...summary.values()]);
});
