import type { NextFunction, Request, Response } from "express";
import { t } from "@compasso/shared";
import { HttpError } from "../lib/http";
import { logger } from "../lib/logger";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: t("error.notFound") } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: t("error.generic") } });
    return;
  }
  logger.error({ err, path: req.path }, "Erro não tratado");
  res.status(500).json({ error: { code: "INTERNAL", message: t("error.generic") } });
}
