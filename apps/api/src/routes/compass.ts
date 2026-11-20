import { Router } from "express";
import { addDays, blocksForDate, consecutiveMisses, type BlockLogStatus, type CompassTodayDTO } from "@compasso/shared";
import { toSettingsDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { dayBoundsUtc, fromDbDate, toDbDate, todayIn } from "../lib/time";
import { userId } from "../middleware/auth";
import { listUserBlocksWithCreation } from "../services/blocks";
import { toDailyFocusDTO } from "./focus";

export const compassRouter = Router();

/**
 * Nunca falhe duas vezes: dias de histórico consultados. Antes disso o registro é desconhecido e não conta como
 * falha; com o limite de 7 falhas seguidas, cobre até um bloco semanal.
 */
const MISS_LOOKBACK_DAYS = 60;

/** RF04 — blocos de hoje (no fuso do usuário) já ordenados, com o log do dia. Uma chamada por dia: o relógio roda no front (RNF08). */
compassRouter.get("/today", async (req, res) => {
  const id = userId(req);
  const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { settings: true } });
  const date = todayIn(user.timezone);
  const { start, end } = dayBoundsUtc(date, user.timezone);
  const historyFrom = addDays(date, -MISS_LOOKBACK_DAYS);

  const [{ blocks, createdOn }, logs, qpToday, settings, focus] = await Promise.all([
    listUserBlocksWithCreation(id, user.timezone),
    prisma.blockLog.findMany({
      where: { userId: id, date: { gte: toDbDate(historyFrom), lte: toDbDate(date) } },
      select: { blockId: true, date: true, status: true },
    }),
    prisma.qpSession.count({ where: { userId: id, completed: true, startedAt: { gte: start, lt: end } } }),
    user.settings ?? prisma.userSettings.create({ data: { userId: id } }),
    prisma.dailyFocus.findUnique({ where: { userId_date: { userId: id, date: toDbDate(date) } } }),
    // Atividade do dia para DAU/WAU/MAU e retenção (RF08).
    prisma.userActivity.upsert({
      where: { userId_date: { userId: id, date: toDbDate(date) } },
      update: {},
      create: { userId: id, date: toDbDate(date) },
    }),
  ]);

  const statusByKey = new Map<string, BlockLogStatus>(logs.map((l) => [`${l.blockId}|${fromDbDate(l.date)}`, l.status]));
  const body: CompassTodayDTO = {
    date,
    timezone: user.timezone,
    blocks: blocksForDate(blocks, date).map((b) => {
      const created = createdOn.get(b.id);
      const notBefore = created && created > historyFrom ? created : historyFrom;
      const { misses, previousDate } = consecutiveMisses(b, date, (day) => statusByKey.get(`${b.id}|${day}`), {
        notBefore,
      });
      return { ...b, log: statusByKey.get(`${b.id}|${date}`) ?? null, previousMisses: misses, previousDate };
    }),
    settings: toSettingsDTO(settings),
    qpToday,
    focus: focus ? toDailyFocusDTO(focus) : null,
  };
  res.json(body);
});
