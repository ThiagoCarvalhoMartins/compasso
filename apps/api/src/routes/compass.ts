import { Router } from "express";
import { blocksForDate, type CompassTodayDTO } from "@compasso/shared";
import { toSettingsDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { dayBoundsUtc, toDbDate, todayIn } from "../lib/time";
import { userId } from "../middleware/auth";
import { listUserBlocks } from "../services/blocks";

export const compassRouter = Router();

/** RF04 — blocos de hoje (no fuso do usuário) já ordenados, com o log do dia. Uma chamada por dia: o relógio roda no front (RNF08). */
compassRouter.get("/today", async (req, res) => {
  const id = userId(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { settings: true } });
  const date = todayIn(user.timezone);
  const { start, end } = dayBoundsUtc(date, user.timezone);

  const [blocks, logs, qpToday, settings] = await Promise.all([
    listUserBlocks(id),
    prisma.blockLog.findMany({ where: { userId: id, date: toDbDate(date) } }),
    prisma.qpSession.count({ where: { userId: id, completed: true, startedAt: { gte: start, lt: end } } }),
    user.settings ?? prisma.userSettings.create({ data: { userId: id } }),
    // Atividade do dia para DAU/WAU/MAU e retenção (RF08).
    prisma.userActivity.upsert({
      where: { userId_date: { userId: id, date: toDbDate(date) } },
      update: {},
      create: { userId: id, date: toDbDate(date) },
    }),
  ]);

  const logByBlock = new Map(logs.map((l) => [l.blockId, l.status]));
  const body: CompassTodayDTO = {
    date,
    timezone: user.timezone,
    blocks: blocksForDate(blocks, date).map((b) => ({ ...b, log: logByBlock.get(b.id) ?? null })),
    settings: toSettingsDTO(settings),
    qpToday,
  };
  res.json(body);
});
