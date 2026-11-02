import type { Request, Response } from "express";
import type { User } from "@prisma/client";
import type { AuthResponse } from "@compasso/shared";
import { isProd } from "../env";
import { unauthorized } from "../lib/http";
import { toUserDTO } from "../lib/mappers";
import { prisma } from "../lib/prisma";
import {
  REFRESH_TTL_MS,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../lib/tokens";

export type SessionApp = "web" | "admin";

/** Cada front-end tem seu cookie, para que entrar no admin não derrube a sessão do app (e vice-versa). */
const cookieName = (app: SessionApp) => (app === "admin" ? "compasso_admin_rt" : "compasso_rt");

/** RNF04: refresh token em cookie httpOnly, secure e SameSite. */
const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  // Em produção os front-ends e a API podem estar em domínios diferentes (*.azurestaticapps.net / *.azurewebsites.net).
  sameSite: isProd ? ("none" as const) : ("lax" as const),
  path: "/api/v1",
  maxAge: REFRESH_TTL_MS,
};

export async function startSession(req: Request, res: Response, user: User, app: SessionApp): Promise<AuthResponse> {
  const refreshToken = await issueRefreshToken(user.id, req.headers["user-agent"]);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  res.cookie(cookieName(app), refreshToken, cookieOptions);
  return { accessToken: signAccessToken({ sub: user.id, role: user.role }), user: toUserDTO(user) };
}

export async function refreshSession(req: Request, res: Response, app: SessionApp): Promise<AuthResponse> {
  const token = req.cookies?.[cookieName(app)];
  if (!token) throw unauthorized();
  const rotated = await rotateRefreshToken(token, req.headers["user-agent"]);
  if (!rotated || (app === "admin" && rotated.user.role === "USER")) {
    res.clearCookie(cookieName(app), { path: cookieOptions.path });
    throw unauthorized();
  }
  res.cookie(cookieName(app), rotated.refreshToken, cookieOptions);
  return {
    accessToken: signAccessToken({ sub: rotated.user.id, role: rotated.user.role }),
    user: toUserDTO(rotated.user),
  };
}

export async function endSession(req: Request, res: Response, app: SessionApp) {
  const token = req.cookies?.[cookieName(app)];
  if (token) await revokeRefreshToken(token);
  res.clearCookie(cookieName(app), { path: cookieOptions.path });
}
