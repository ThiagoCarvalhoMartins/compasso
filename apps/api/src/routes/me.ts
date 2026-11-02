import { Router } from "express";
import { profileUpdateSchema, settingsSchema } from "@compasso/shared";
import { badRequest, notFound, parse } from "../lib/http";
import { toBlockDTO, toSettingsDTO, toUserDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { fromDbDate, isValidTimezone, toDbDate } from "../lib/time";
import { userId } from "../middleware/auth";
import { deleteAccount } from "../services/accounts";
import { endSession } from "../services/session";

export const meRouter = Router();

async function getSettings(id: string) {
  return prisma.userSettings.upsert({ where: { userId: id }, update: {}, create: { userId: id } });
}

meRouter.get("/", async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: userId(req) } });
  if (!user || user.status === "DELETED") throw notFound();
  res.json(toUserDTO(user));
});

// RF02.1 / RF02.2
meRouter.patch("/", async (req, res) => {
  const input = parse(profileUpdateSchema, req.body);
  if (input.timezone && !isValidTimezone(input.timezone)) throw badRequest("Fuso horário inválido.");
  const user = await prisma.user.update({
    where: { id: userId(req) },
    data: {
      name: input.name,
      avatarUrl: input.avatarUrl,
      timezone: input.timezone,
      birthDate: input.birthDate ? toDbDate(input.birthDate) : undefined,
    },
  });
  res.json(toUserDTO(user));
});

// RF02.4 / RNF07 — exportação dos próprios dados (LGPD)
meRouter.get("/export", async (req, res) => {
  const id = userId(req);
  const [user, settings, blocks, logs, qp, categories] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id } }),
    getSettings(id),
    prisma.block.findMany({ where: { userId: id } }),
    prisma.blockLog.findMany({ where: { userId: id } }),
    prisma.qpSession.findMany({ where: { userId: id } }),
    prisma.category.findMany({ where: { userId: id } }),
  ]);
  res.setHeader("Content-Disposition", 'attachment; filename="compasso-meus-dados.json"');
  res.json({
    exportedAt: new Date().toISOString(),
    profile: { ...toUserDTO(user), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt },
    settings: toSettingsDTO(settings),
    categories,
    blocks: blocks.map(toBlockDTO),
    blockLogs: logs.map((l) => ({ blockId: l.blockId, date: fromDbDate(l.date), status: l.status, notedAt: l.notedAt })),
    qpSessions: qp.map(({ userId: _u, ...s }) => s),
  });
});

// RF02.4 / RN13 — exclusão da conta
meRouter.delete("/", async (req, res) => {
  await deleteAccount(userId(req));
  await endSession(req, res, "web");
  res.status(204).end();
});

// RF02.3 / RF05.2
meRouter.get("/settings", async (req, res) => {
  res.json(toSettingsDTO(await getSettings(userId(req))));
});

meRouter.put("/settings", async (req, res) => {
  const input = parse(settingsSchema, req.body);
  const settings = await prisma.userSettings.upsert({
    where: { userId: userId(req) },
    update: input,
    create: { userId: userId(req), ...input },
  });
  res.json(toSettingsDTO(settings));
});
