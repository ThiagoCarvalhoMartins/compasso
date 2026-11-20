import { Router } from "express";
import { dateRange, energyCheckSchema, rangeQuerySchema, type EnergyHour } from "@compasso/shared";
import { badRequest, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { dayBoundsUtc, hourIn, sameLocalHour } from "../lib/time";
import { userId } from "../middleware/auth";

export const energyRouter = Router();

// Registra a nota de energia (0 a 10) no instante da resposta, no máximo uma por hora cheia do fuso do usuário.
// O sorteio do app já espaça as perguntas em 2 horas; aqui só se barra o registro manual repetido na mesma hora
// (e duas abas ou dois aparelhos respondendo ao mesmo tempo).
energyRouter.post("/", async (req, res) => {
  const id = userId(req);
  const { score } = parse(energyCheckSchema, req.body);
  const [user, last] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } }),
    prisma.energyCheck.findFirst({ where: { userId: id }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } }),
  ]);
  if (last && sameLocalHour(user.timezone, last.recordedAt, new Date())) {
    throw badRequest("Você já registrou sua energia nesta hora. Tente de novo na próxima.");
  }
  const check = await prisma.energyCheck.create({ data: { userId: id, score } });
  res.status(201).json({ id: check.id, score: check.score, recordedAt: check.recordedAt });
});

// Último registro: o app respeita o intervalo mínimo entre aparelhos e, com energia baixa, destaca a versão de 2 minutos.
energyRouter.get("/last", async (req, res) => {
  const last = await prisma.energyCheck.findFirst({
    where: { userId: userId(req) },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true, score: true },
  });
  res.json({ recordedAt: last?.recordedAt ?? null, score: last?.score ?? null });
});

// Média das notas por hora do dia no período, no fuso do usuário.
energyRouter.get("/summary", async (req, res) => {
  const id = userId(req);
  const { from, to } = parse(rangeQuerySchema, req.query);
  if (to < from) throw badRequest("Período inválido.");
  if (dateRange(from, to).length > 92) throw badRequest("Período máximo de 92 dias.");

  const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } });
  const checks = await prisma.energyCheck.findMany({
    where: { userId: id, recordedAt: { gte: dayBoundsUtc(from, timezone).start, lt: dayBoundsUtc(to, timezone).end } },
    select: { score: true, recordedAt: true },
  });

  const sums = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }));
  for (const c of checks) {
    const slot = sums[hourIn(timezone, c.recordedAt)];
    slot.total += c.score;
    slot.count++;
  }
  const hours: EnergyHour[] = sums.map((s, hour) => ({
    hour,
    count: s.count,
    average: s.count ? Math.round((s.total / s.count) * 10) / 10 : null,
  }));
  res.json(hours);
});
