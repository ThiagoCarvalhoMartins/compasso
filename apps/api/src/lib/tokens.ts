import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Role } from "@compasso/shared";
import { env } from "../env";
import { prisma } from "./prisma";

const ACCESS_TTL = "15m";
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccessPayload {
  sub: string;
  role: Role;
}

/** RNF04: JWT de curta duração. */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TTL, audience: "access" });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_SECRET, { audience: "access" }) as AccessPayload;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Refresh token opaco; só o hash fica no banco. */
export async function issueRefreshToken(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(48).toString("base64url");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      userAgent: userAgent?.slice(0, 255),
    },
  });
  return token;
}

/** Valida e rotaciona o refresh token (o antigo é revogado). */
export async function rotateRefreshToken(token: string, userAgent?: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!record || record.revokedAt || record.expiresAt < new Date() || record.user.status !== "ACTIVE") {
    return null;
  }
  await prisma.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
  const next = await issueRefreshToken(record.userId, userAgent);
  return { user: record.user, refreshToken: next };
}

export async function revokeRefreshToken(token: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokens(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/**
 * Tokens de uso único para confirmação de e-mail e redefinição de senha.
 * O segredo inclui um "fingerprint" do estado atual do usuário, então o link
 * deixa de valer assim que o e-mail é confirmado ou a senha muda.
 */
type Purpose = "verify-email" | "reset-password";

const purposeSecret = (fingerprint: string) => `${env.JWT_SECRET}:${fingerprint}`;

export function signPurposeToken(userId: string, purpose: Purpose, fingerprint: string): string {
  return jwt.sign({ sub: userId }, purposeSecret(fingerprint), {
    audience: purpose,
    expiresIn: purpose === "verify-email" ? "24h" : "1h",
  });
}

export function decodePurposeToken(token: string): string | null {
  const decoded = jwt.decode(token) as { sub?: string } | null;
  return decoded?.sub ?? null;
}

export function verifyPurposeToken(token: string, purpose: Purpose, fingerprint: string): boolean {
  try {
    jwt.verify(token, purposeSecret(fingerprint), { audience: purpose });
    return true;
  } catch {
    return false;
  }
}
