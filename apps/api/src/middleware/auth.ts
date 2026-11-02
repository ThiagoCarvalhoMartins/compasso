import type { NextFunction, Request, Response } from "express";
import type { Role } from "@compasso/shared";
import { forbidden, unauthorized } from "../lib/http";
import { verifyAccessToken } from "../lib/tokens";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; role: Role };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw unauthorized();
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.auth = { userId: payload.sub, role: payload.role };
  } catch {
    throw unauthorized();
  }
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) throw forbidden();
    next();
  };

export const userId = (req: Request) => req.auth!.userId;
