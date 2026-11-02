import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import type { User } from "@prisma/client";
import {
  emailSchema,
  forgotPasswordSchema,
  googleAuthSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  t,
  tokenSchema,
} from "@compasso/shared";
import { z } from "zod";
import { env } from "../env";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/email";
import { HttpError, badRequest, conflict, parse } from "../lib/http";
import { prisma } from "../lib/prisma";
import { isValidTimezone, toDbDate } from "../lib/time";
import {
  decodePurposeToken,
  revokeAllRefreshTokens,
  signPurposeToken,
  verifyPurposeToken,
} from "../lib/tokens";
import { endSession, refreshSession, startSession } from "../services/session";

export const authRouter = Router();

/** RNF05: rate limit nas rotas sensíveis. */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { error: { code: "TOO_MANY", message: t("error.tooMany") } },
});

const googleClient = new OAuth2Client();

const verifyFingerprint = (u: User) => `${u.email}:${u.emailVerifiedAt?.getTime() ?? "pendente"}`;
const resetFingerprint = (u: User) => u.passwordHash ?? "sem-senha";
const safeTimezone = (tz?: string) => (tz && isValidTimezone(tz) ? tz : undefined);

export function sendVerification(user: User) {
  return sendVerificationEmail(user.email, user.name, signPurposeToken(user.id, "verify-email", verifyFingerprint(user)));
}

export function sendReset(user: User) {
  return sendPasswordResetEmail(user.email, user.name, signPurposeToken(user.id, "reset-password", resetFingerprint(user)));
}

function assertCanLogin(user: User) {
  if (user.status === "BLOCKED") throw new HttpError(403, t("auth.blocked"), "BLOCKED");
  if (user.status === "DELETED") throw new HttpError(401, t("auth.invalidCredentials"), "INVALID_CREDENTIALS");
}

// RF01.1 — cadastro
authRouter.post("/register", limiter, async (req, res) => {
  const input = parse(registerSchema, req.body);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw conflict(t("auth.emailTaken"), "EMAIL_TAKEN");
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 12),
      birthDate: toDbDate(input.birthDate),
      timezone: safeTimezone(input.timezone),
      settings: { create: {} },
    },
  });
  await sendVerification(user);
  res.status(201).json({ message: "Enviamos um link de confirmação para o seu e-mail." });
});

// RF01.2 — confirmação de e-mail
authRouter.post("/verify-email", async (req, res) => {
  const { token } = parse(tokenSchema, req.body);
  const userId = decodePurposeToken(token);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user || !verifyPurposeToken(token, "verify-email", verifyFingerprint(user))) {
    throw badRequest(t("auth.invalidToken"), "INVALID_TOKEN");
  }
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  res.json({ message: "E-mail confirmado. Você já pode entrar." });
});

authRouter.post("/resend-verification", limiter, async (req, res) => {
  const { email } = parse(z.object({ email: emailSchema }), req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt && user.status === "ACTIVE") await sendVerification(user);
  res.status(204).end();
});

// RF01.3 — login com e-mail e senha
authRouter.post("/login", limiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new HttpError(401, t("auth.invalidCredentials"), "INVALID_CREDENTIALS");
  }
  assertCanLogin(user);
  if (!user.emailVerifiedAt) throw new HttpError(403, t("auth.emailNotVerified"), "EMAIL_NOT_VERIFIED");
  res.json(await startSession(req, res, user, "web"));
});

// RF01.4 / RF01.5 — login com Google, cadastro com data de nascimento e vínculo por e-mail
authRouter.post("/google", limiter, async (req, res) => {
  const input = parse(googleAuthSchema, req.body);
  if (!env.GOOGLE_CLIENT_ID) throw new HttpError(503, "Login com Google não configurado.", "GOOGLE_DISABLED");

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: input.credential, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, t("auth.invalidToken"), "INVALID_TOKEN");
  }
  if (!payload?.sub || !payload.email) throw new HttpError(401, t("auth.invalidToken"), "INVALID_TOKEN");
  const email = payload.email.toLowerCase();

  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

  if (!user) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // RF01.5: vincula a conta Google à conta existente com o mesmo e-mail (só se o Google confirmou o e-mail).
      if (!payload.email_verified) throw conflict(t("auth.emailTaken"), "EMAIL_TAKEN");
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { googleId: payload.sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
    } else {
      // O Google não fornece a data de nascimento: o front pede e reenvia (etapa "completar cadastro").
      if (!input.birthDate || !input.acceptPrivacy) {
        throw new HttpError(428, t("auth.needsBirthDate"), "NEEDS_BIRTH_DATE", {
          name: payload.name,
          email,
        });
      }
      user = await prisma.user.create({
        data: {
          name: payload.name ?? email.split("@")[0],
          email,
          googleId: payload.sub,
          avatarUrl: payload.picture,
          birthDate: toDbDate(input.birthDate),
          timezone: safeTimezone(input.timezone),
          emailVerifiedAt: new Date(),
          settings: { create: {} },
        },
      });
    }
  }

  assertCanLogin(user);
  res.json(await startSession(req, res, user, "web"));
});

authRouter.post("/refresh", async (req, res) => {
  res.json(await refreshSession(req, res, "web"));
});

// RF01.7
authRouter.post("/logout", async (req, res) => {
  await endSession(req, res, "web");
  res.status(204).end();
});

// RF01.6 — recuperação de senha (resposta sempre igual, para não revelar e-mails cadastrados)
authRouter.post("/forgot-password", limiter, async (req, res) => {
  const { email } = parse(forgotPasswordSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") await sendReset(user);
  res.json({ message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." });
});

authRouter.post("/reset-password", async (req, res) => {
  const input = parse(resetPasswordSchema, req.body);
  const userId = decodePurposeToken(input.token);
  const user = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
  if (!user || !verifyPurposeToken(input.token, "reset-password", resetFingerprint(user))) {
    throw badRequest(t("auth.invalidToken"), "INVALID_TOKEN");
  }
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(input.password, 12),
      // Quem recebeu o link comprovou o e-mail.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
  await revokeAllRefreshTokens(user.id);
  res.json({ message: "Senha redefinida. Entre com a nova senha." });
});
