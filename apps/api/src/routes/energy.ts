import { Router } from "express";
import { dateRange, energyCheckSchema, rangeQuerySchema, type EnergyHour } from "@compasso/shared";
import { badRequest, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { dayBoundsUtc, hourIn } from "../lib/time";
import { userId } from "../middleware/auth";

export const energyRouter = Router();

/** Intervalo mínimo entre dois registros: o questionário aparece no máximo uma vez a cada 2 horas. */
const MIN_GAP_MS = 2 * 60 * 60 * 1000;

// Registra a nota de energia (0 a 10) no instante da resposta.
energyRouter.post("/", async (req, res) => {
  const id = userId(req);
  const { score } = parse(energyCheckSchema, req.body);
  // Evita registros duplicados (duas abas ou dois aparelhos respondendo ao mesmo tempo).
  const recent = await prisma.energyCheck.findFirst({
    where: { userId: id, recordedAt: { gt: new Date(Date.now() - MIN_GAP_MS) } },
    select: { id: true },
  });
  if (recent) throw badRequest("Você já registrou sua energia nas últimas 2 horas.");
  const check = await prisma.energyCheck.create({ data: { userId: id, score } });
  res.status(201).json({ id: check.id, score: check.score, recordedAt: check.recordedAt });
});

// Último registro, para o app respeitar o intervalo mínimo entre aparelhos.
energyRouter.get("/last", async (req, res) => {
  const last = await prisma.energyCheck.findFirst({
    where: { userId: userId(req) },
    orderBy: { recordedAt: "desc" },
    select: { recordedAt: true },
  });
  res.json({ recordedAt: last?.recordedAt ?? null });
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
