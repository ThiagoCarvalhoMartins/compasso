import { z } from "zod";

/** RNF06: todos os segredos vêm de variáveis de ambiente (no Azure, referências ao Key Vault). */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:5174"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Compasso <nao-responda@agendaemritmo.com.br>"),
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
