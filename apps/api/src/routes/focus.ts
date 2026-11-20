import { Router } from "express";
import {
  blockAppliesOn,
  dailyFocusSchema,
  dateRange,
  dateSchema,
  rangeQuerySchema,
  type DailyFocusDTO,
  type FocusSummaryDay,
} from "@compasso/shared";
import type { DailyFocus } from "@prisma/client";
import { badRequest, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { fromDbDate, toDbDate, todayIn } from "../lib/time";
import { userId } from "../middleware/auth";
import { listUserBlocks } from "../services/blocks";

export const focusRouter = Router();

export const toDailyFocusDTO = (f: DailyFocus): DailyFocusDTO => ({
  date: fromDbDate(f.date),
  answer: f.answer,
  blockId: f.blockId,
  skipped: f.skipped,
});

// Pergunta focal (A Única Coisa): grava a resposta do dia, o bloco escolhido ou o "Agora não".
focusRouter.put("/:date", async (req, res) => {
  const id = userId(req);
  const date = parse(dateSchema, req.params.date);
  const input = parse(dailyFocusSchema, req.body);
  const { timezone } = await prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } });
  if (date < todayIn(timezone)) throw badRequest("Não é possível mudar a Única Coisa de um dia que já passou.");

  const blockId = input.skipped ? null : (input.blockId ?? null);
  if (blockId) {
    const block = (await listUserBlocks(id)).find((b) => b.id === blockId);
    if (!block || !blockAppliesOn(block, date)) throw badRequest("Escolha um bloco desse dia.");
  }
  const data = { answer: input.skipped ? null : input.answer || null, blockId, skipped: input.skipped };
  const focus = await prisma.dailyFocus.upsert({
    where: { userId_date: { userId: id, date: toDbDate(date) } },
    update: data,
    create: { userId: id, date: toDbDate(date), ...data },
  });
  res.json(toDailyFocusDTO(focus));
});

// Analytics — a Única Coisa de cada dia e como foi marcada: o bloco da pergunta focal ou, sem ela, o de estrela.
focusRouter.get("/summary", async (req, res) => {
  const id = userId(req);
  const { from, to } = parse(rangeQuerySchema, req.query);
  if (to < from) throw badRequest("Período inválido.");
  const days = dateRange(from, to);
  if (days.length > 92) throw badRequest("Período máximo de 92 dias.");

  const range = { gte: toDbDate(from), lte: toDbDate(to) };
  const [blocks, focuses, logs] = await Promise.all([
    listUserBlocks(id),
    prisma.dailyFocus.findMany({ where: { userId: id, date: range } }),
    prisma.blockLog.findMany({ where: { userId: id, date: range }, select: { blockId: true, date: true, status: true } }),
  ]);
  const focusByDate = new Map(focuses.map((f) => [fromDbDate(f.date), f]));
  const statusOf = new Map(logs.map((l) => [`${l.blockId}|${fromDbDate(l.date)}`, l.status]));

  const summary: FocusSummaryDay[] = [];
  for (const date of days) {
    // Mesma regra da tela Compasso: respondida, vale o bloco escolhido (ou nenhum); sem resposta, a estrela.
    const focus = focusByDate.get(date);
    const block =
      focus && !focus.skipped
        ? blocks.find((b) => b.id === focus.blockId && blockAppliesOn(b, date))
        : blocks.find((b) => b.isOneThing && blockAppliesOn(b, date));
    if (!block) continue;
    summary.push({
      date,
      title: block.title,
      startTime: block.startTime,
      endTime: block.endTime,
      status: statusOf.get(`${block.id}|${date}`) ?? null,
    });
  }
  res.json(summary);
});
