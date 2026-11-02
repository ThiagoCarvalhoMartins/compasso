import { Router, type Request } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import {
  adminResendSchema,
  adminStatusSchema,
  adminUsersQuerySchema,
  loginSchema,
  reportQuerySchema,
  t,
} from "@compasso/shared";
import { z } from "zod";
import { env } from "../env";
import { HttpError, badRequest, forbidden, notFound, parse } from "../lib/http";
import { toUserDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import { toDbDate } from "../lib/time";
import { revokeAllRefreshTokens } from "../lib/tokens";
import { requireAuth, requireRole, userId } from "../middleware/auth";
import { deleteAccount } from "../services/accounts";
import { buildReport, dashboard, toCsv, toPdf } from "../services/reports";
import { endSession, refreshSession, startSession } from "../services/session";
import { sendReset, sendVerification } from "./auth";

export const adminRouter = Router();

// ---------- RF06.1 — login exclusivo para administradores ----------

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => env.NODE_ENV === "test",
  message: { error: { code: "TOO_MANY", message: t("error.tooMany") } },
});

adminRouter.post("/auth/login", limiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = user?.passwordHash && (await bcrypt.compare(input.password, user.passwordHash));
  if (!user || !valid || user.role === "USER" || user.status !== "ACTIVE") {
    throw new HttpError(401, t("auth.invalidCredentials"), "INVALID_CREDENTIALS");
  }
  res.json(await startSession(req, res, user, "admin"));
});

adminRouter.post("/auth/refresh", async (req, res) => {
  res.json(await refreshSession(req, res, "admin"));
});

adminRouter.post("/auth/logout", async (req, res) => {
  await endSession(req, res, "admin");
  res.status(204).end();
});

// ---------- RF06.2 — daqui em diante: Administrador ou Suporte ----------

adminRouter.use(requireAuth, requireRole("ADMIN", "SUPPORT"));
const adminOnly = requireRole("ADMIN");

/** RF07.5 — toda ação administrativa vai para o log de auditoria. */
function audit(req: Request, action: string, targetUserId: string | null, metadata?: Prisma.InputJsonValue) {
  return prisma.auditLog.create({ data: { adminId: userId(req), action, targetUserId, metadata } });
}

// RF07.1
adminRouter.get("/users", async (req, res) => {
  const q = parse(adminUsersQuerySchema, req.query);
  const where: Prisma.UserWhereInput = {
    ...(q.q ? { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }] } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.loginType === "google" ? { googleId: { not: null } } : {}),
    ...(q.loginType === "email" ? { googleId: null } : {}),
    ...(q.createdFrom || q.createdTo
      ? {
          createdAt: {
            ...(q.createdFrom ? { gte: toDbDate(q.createdFrom) } : {}),
            ...(q.createdTo ? { lt: new Date(toDbDate(q.createdTo).getTime() + 86_400_000) } : {}),
          },
        }
      : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: users.map((u) => ({ ...toUserDTO(u), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })),
  });
});

// RF07.2
adminRouter.get("/users/:id", async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { blocks: true, qpSessions: true } } },
  });
  if (!user) throw notFound();
  res.json({
    ...toUserDTO(user),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    blocksCount: user._count.blocks,
    qpSessionsCount: user._count.qpSessions,
  });
});

// RF07.3 — Suporte só pode desbloquear
adminRouter.patch("/users/:id/status", async (req, res) => {
  const { status } = parse(adminStatusSchema, req.body);
  if (req.auth!.role === "SUPPORT" && status !== "ACTIVE") throw forbidden();
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.status === "DELETED") throw notFound();
  if (target.id === userId(req)) throw badRequest("Você não pode alterar o próprio status.");
  const user = await prisma.user.update({ where: { id: target.id }, data: { status } });
  if (status === "BLOCKED") await revokeAllRefreshTokens(target.id);
  await audit(req, status === "BLOCKED" ? "user.block" : "user.unblock", target.id, { from: target.status, to: status });
  res.json(toUserDTO(user));
});

adminRouter.delete("/users/:id", adminOnly, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.status === "DELETED") throw notFound();
  if (target.id === userId(req)) throw badRequest("Você não pode excluir a própria conta por aqui.");
  await deleteAccount(target.id);
  await audit(req, "user.delete", target.id);
  res.status(204).end();
});

// RF07.4
adminRouter.post("/users/:id/resend", adminOnly, async (req, res) => {
  const { type } = parse(adminResendSchema, req.body);
  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target || target.status === "DELETED") throw notFound();
  if (type === "verify") {
    if (target.emailVerifiedAt) throw badRequest("Este e-mail já foi confirmado.");
    await sendVerification(target);
  } else {
    await sendReset(target);
  }
  await audit(req, `user.resend.${type}`, target.id);
  res.status(204).end();
});

// RF08
adminRouter.get("/dashboard", async (_req, res) => {
  res.json(await dashboard());
});

// RF09
adminRouter.get("/reports/:type", async (req, res) => {
  const type = parse(z.enum(["cadastros", "engajamento"]), req.params.type);
  const q = parse(reportQuerySchema, req.query);
  if (q.to < q.from) throw badRequest("Período inválido.");
  const rows = await buildReport(type, q.from, q.to, q.ageGroup);
  await audit(req, "report.view", null, { type, from: q.from, to: q.to, ageGroup: q.ageGroup ?? null, format: q.format });

  const filename = `compasso-${type}-${q.from}-a-${q.to}`;
  if (q.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    res.send(toCsv(rows));
    return;
  }
  if (q.format === "pdf") {
    const title = `Relatório de ${type} — ${q.from} a ${q.to}${q.ageGroup ? ` (${q.ageGroup} anos)` : ""}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
    res.send(await toPdf(title, rows));
    return;
  }
  res.json(rows);
});

adminRouter.get("/audit-logs", async (req, res) => {
  const { page, pageSize } = parse(
    z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(30) }),
    req.query,
  );
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { name: true, email: true } }, targetUser: { select: { name: true, email: true } } },
    }),
  ]);
  res.json({ total, page, pageSize, items: logs });
});
