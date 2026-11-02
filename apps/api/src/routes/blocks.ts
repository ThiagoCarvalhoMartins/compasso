import { Router } from "express";
import {
  blockInputSchema,
  blockLogSchema,
  blocksForDate,
  categorySchema,
  copyDaySchema,
  dateSchema,
  t,
} from "@compasso/shared";
import { z } from "zod";
import { badRequest, notFound, parse } from "../lib/http";
import { toBlockDTO, toCategoryDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { toDbDate, todayIn } from "../lib/time";
import { userId } from "../middleware/auth";
import {
  assertBlockAllowed,
  assertCategory,
  listUserBlocks,
  normalizeBlock,
  toBlockData,
} from "../services/blocks";

export const categoriesRouter = Router();
export const blocksRouter = Router();

const userTimezone = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } })).timezone;

// ---------- Categorias ----------

categoriesRouter.get("/", async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId: userId(req) }] },
    orderBy: [{ userId: "asc" }, { name: "asc" }],
  });
  res.json(categories.map(toCategoryDTO));
});

categoriesRouter.post("/", async (req, res) => {
  const input = parse(categorySchema, req.body);
  const category = await prisma.category.create({ data: { ...input, userId: userId(req) } });
  res.status(201).json(toCategoryDTO(category));
});

// ---------- Blocos ----------

/** Sem ?date= devolve todos os blocos do usuário (o front expande a semana); com ?date= devolve o dia montado. */
blocksRouter.get("/", async (req, res) => {
  const { date } = parse(z.object({ date: dateSchema.optional() }), req.query);
  const blocks = await listUserBlocks(userId(req));
  res.json(date ? blocksForDate(blocks, date) : blocks);
});

// RF03.1 / RF03.2
blocksRouter.post("/", async (req, res) => {
  const id = userId(req);
  const block = normalizeBlock(parse(blockInputSchema, req.body));
  await assertCategory(id, block.categoryId);
  await assertBlockAllowed(id, await userTimezone(id), block, { checkPastDate: true });
  const created = await prisma.block.create({ data: { ...toBlockData(block), userId: id } });
  res.status(201).json(toBlockDTO(created));
});

// RF03.3 — editar um recorrente afeta todos os dias em que ele se repete
blocksRouter.patch("/:id", async (req, res) => {
  const id = userId(req);
  const current = await prisma.block.findFirst({ where: { id: req.params.id, userId: id } });
  if (!current) throw notFound();
  const merged = { ...toBlockDTO(current), ...req.body };
  const block = normalizeBlock(parse(blockInputSchema, merged));
  await assertCategory(id, block.categoryId);
  const dateChanged = block.recurrence === "ONCE" && block.date !== toBlockDTO(current).date;
  await assertBlockAllowed(id, await userTimezone(id), { ...block, id: current.id }, { checkPastDate: dateChanged });
  const updated = await prisma.block.update({ where: { id: current.id }, data: toBlockData(block) });
  res.json(toBlockDTO(updated));
});

blocksRouter.delete("/:id", async (req, res) => {
  const { count } = await prisma.block.deleteMany({ where: { id: req.params.id, userId: userId(req) } });
  if (!count) throw notFound();
  res.status(204).end();
});

// RF03.5 — copia os blocos de um dia para outro como blocos "Apenas neste dia"
blocksRouter.post("/copy-day", async (req, res) => {
  const id = userId(req);
  const { fromDate, toDate } = parse(copyDaySchema, req.body);
  if (fromDate === toDate) throw badRequest("Escolha um dia diferente para copiar.");
  const timezone = await userTimezone(id);
  if (toDate < todayIn(timezone)) throw badRequest(t("block.pastDate"), "PAST_DATE");

  const source = blocksForDate(await listUserBlocks(id), fromDate);
  const copies = source.map((b) => ({
    ...b,
    id: undefined,
    recurrence: "ONCE" as const,
    date: toDate,
    repeatWeekdays: [],
    startsOn: null,
  }));
  // Valida todas as cópias antes de gravar (tudo ou nada).
  for (const copy of copies) await assertBlockAllowed(id, timezone, copy, { checkPastDate: false });
  await prisma.block.createMany({ data: copies.map((c) => ({ ...toBlockData(c), userId: id })) });
  res.status(201).json({ copied: copies.length });
});

// RF04.11 — marca o bloco do dia como concluído, parcial ou não realizado
blocksRouter.put("/:id/logs/:date", async (req, res) => {
  const id = userId(req);
  const date = parse(dateSchema, req.params.date);
  const { status } = parse(blockLogSchema, req.body);
  const block = await prisma.block.findFirst({ where: { id: req.params.id, userId: id } });
  if (!block) throw notFound();
  const log = await prisma.blockLog.upsert({
    where: { blockId_date: { blockId: block.id, date: toDbDate(date) } },
    update: { status, notedAt: new Date() },
    create: { blockId: block.id, userId: id, date: toDbDate(date), status },
  });
  res.json({ blockId: log.blockId, date, status: log.status });
});
