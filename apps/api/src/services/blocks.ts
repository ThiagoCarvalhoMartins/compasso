import type { Prisma } from "@prisma/client";
import {
  findOneThingConflict,
  findOverlap,
  serializeWeekdays,
  t,
  type BlockDTO,
  type BlockInput,
} from "@compasso/shared";
import { badRequest, conflict } from "../lib/http";
import { toBlockDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { toDbDate, toDbTime, todayIn } from "../lib/time";

export async function listUserBlocks(userId: string): Promise<BlockDTO[]> {
  const blocks = await prisma.block.findMany({ where: { userId }, orderBy: { startTime: "asc" } });
  return blocks.map(toBlockDTO);
}

/** Normaliza a entrada: cada recorrência guarda só os campos que usa. */
export function normalizeBlock(input: BlockInput): Omit<BlockDTO, "id"> {
  const isOnce = input.recurrence === "ONCE";
  return {
    title: input.title,
    description: input.description ?? null,
    categoryId: input.categoryId ?? null,
    color: input.color,
    recurrence: input.recurrence,
    date: isOnce ? input.date! : null,
    repeatWeekdays: isOnce ? [] : [...new Set(input.repeatWeekdays)].sort(),
    startsOn: isOnce ? null : input.startsOn!,
    startTime: input.startTime,
    endTime: input.endTime,
    isOneThing: input.isOneThing,
  };
}

/** Regras que dependem do banco: RN15 (data passada), RN05 (sobreposição) e RN10 (A Única Coisa). */
export async function assertBlockAllowed(
  userId: string,
  timezone: string,
  candidate: Omit<BlockDTO, "id"> & { id?: string },
  { checkPastDate }: { checkPastDate: boolean },
) {
  if (checkPastDate && candidate.recurrence === "ONCE" && candidate.date! < todayIn(timezone)) {
    throw badRequest(t("block.pastDate"), "PAST_DATE");
  }
  const existing = await listUserBlocks(userId);
  const overlap = findOverlap(candidate, existing);
  if (overlap) {
    throw conflict(
      t("block.overlap", { title: overlap.title, start: overlap.startTime, end: overlap.endTime }),
      "OVERLAP",
    );
  }
  const oneThing = findOneThingConflict(candidate, existing);
  if (oneThing) throw conflict(t("block.oneThingTaken", { title: oneThing.title }), "ONE_THING_TAKEN");
}

export function toBlockData(block: Omit<BlockDTO, "id">) {
  return {
    title: block.title,
    description: block.description,
    categoryId: block.categoryId,
    color: block.color,
    recurrence: block.recurrence,
    date: block.date ? toDbDate(block.date) : null,
    repeatWeekdays: block.repeatWeekdays.length ? serializeWeekdays(block.repeatWeekdays) : null,
    startsOn: block.startsOn ? toDbDate(block.startsOn) : null,
    startTime: toDbTime(block.startTime),
    endTime: toDbTime(block.endTime),
    isOneThing: block.isOneThing,
  } satisfies Omit<Prisma.BlockUncheckedCreateInput, "userId">;
}

/** A categoria precisa ser padrão do sistema ou do próprio usuário. */
export async function assertCategory(userId: string, categoryId: string | null) {
  if (!categoryId) return;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, OR: [{ userId: null }, { userId }] },
  });
  if (!category) throw badRequest("Categoria inválida.", "INVALID_CATEGORY");
}
