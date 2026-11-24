import { Router } from "express";
import { microHabitSchema, type MicroHabitDTO } from "@compasso/shared";
import type { MicroHabit } from "@prisma/client";
import { badRequest, notFound, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { todayIn } from "../lib/time";
import { userId } from "../middleware/auth";

export const microHabitsRouter = Router();

const MAX_HABITS = 50;

const toMicroHabitDTO = (h: MicroHabit & { blocks: { id: string }[] }, timezone: string): MicroHabitDTO => ({
  id: h.id,
  title: h.title,
  identity: h.identity,
  createdOn: todayIn(timezone, h.createdAt),
  blockIds: h.blocks.map((b) => b.id),
});

const withBlocks = { blocks: { select: { id: true } } } as const;

const timezoneOf = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id }, select: { timezone: true } })).timezone;

async function findOwn(userId: string, id: string) {
  const habit = await prisma.microHabit.findFirst({ where: { id, userId }, select: { id: true } });
  if (!habit) throw notFound();
  return habit;
}

// Empilhamento de hábitos (Hábitos Atômicos): micro-hábitos com os blocos depois dos quais são feitos.
microHabitsRouter.get("/", async (req, res) => {
  const id = userId(req);
  const [habits, timezone] = await Promise.all([
    prisma.microHabit.findMany({ where: { userId: id }, include: withBlocks, orderBy: { createdAt: "asc" } }),
    timezoneOf(id),
  ]);
  res.json(habits.map((h) => toMicroHabitDTO(h, timezone)));
});

microHabitsRouter.post("/", async (req, res) => {
  const id = userId(req);
  const input = parse(microHabitSchema, req.body);
  if ((await prisma.microHabit.count({ where: { userId: id } })) >= MAX_HABITS) {
    throw badRequest(`Limite de ${MAX_HABITS} micro-hábitos atingido.`);
  }
  const habit = await prisma.microHabit.create({
    data: { userId: id, title: input.title, identity: input.identity || null },
    include: withBlocks,
  });
  res.status(201).json(toMicroHabitDTO(habit, await timezoneOf(id)));
});

microHabitsRouter.patch("/:id", async (req, res) => {
  const id = userId(req);
  const input = parse(microHabitSchema, req.body);
  await findOwn(id, req.params.id);
  const habit = await prisma.microHabit.update({
    where: { id: req.params.id },
    data: { title: input.title, identity: input.identity || null },
    include: withBlocks,
  });
  res.json(toMicroHabitDTO(habit, await timezoneOf(id)));
});

// Os blocos continuam; só deixam de ter o micro-hábito empilhado (onDelete: SetNull).
microHabitsRouter.delete("/:id", async (req, res) => {
  await findOwn(userId(req), req.params.id);
  await prisma.microHabit.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
