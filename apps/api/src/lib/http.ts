import type { ZodTypeAny, z } from "zod";
import { t, type messages } from "@compasso/shared";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, code?: string, details?: unknown) =>
  new HttpError(400, message, code, details);
export const unauthorized = () => new HttpError(401, t("auth.unauthorized"), "UNAUTHORIZED");
export const forbidden = (key: keyof typeof messages = "auth.forbidden") => new HttpError(403, t(key), "FORBIDDEN");
export const notFound = () => new HttpError(404, t("error.notFound"), "NOT_FOUND");
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);

/** RNF05: valida qualquer entrada com o schema Zod compartilhado. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = result.error.flatten().fieldErrors;
    const first = result.error.issues[0]?.message ?? t("error.generic");
    throw badRequest(first, "VALIDATION", fields);
  }
  return result.data;
}
