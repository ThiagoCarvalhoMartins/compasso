import { z } from "zod";
import {
  ALERT_SOUNDS,
  BLOCK_LOG_STATUSES,
  MIN_AGE,
  QP_DURATIONS,
  RECURRENCES,
  USER_STATUSES,
} from "./constants";
import { t } from "./i18n";
import { ageOn, isValidDate, isValidTime, validateBlockTimes } from "./rules";

const todayUtc = () => new Date().toISOString().slice(0, 10);

export const emailSchema = z.string().trim().toLowerCase().email(t("validation.email")).max(191);

/** RN03: mínimo de 8 caracteres, com letras e números. */
export const passwordSchema = z
  .string()
  .min(8, t("validation.password"))
  .max(128)
  .regex(/[A-Za-z]/, t("validation.password"))
  .regex(/\d/, t("validation.password"));

export const dateSchema = z.string().refine(isValidDate, t("validation.date"));
export const timeSchema = z.string().refine(isValidTime, t("validation.time"));

/** RN02: pelo menos 13 anos pela data de nascimento. */
export const birthDateSchema = dateSchema.refine(
  (value) => ageOn(value, todayUtc()) >= MIN_AGE,
  t("validation.minAge"),
);

export const nameSchema = z.string().trim().min(2, t("validation.required")).max(120);

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  /** RNF07: consentimento explícito. */
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: t("validation.consent") }) }),
  timezone: z.string().max(64).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, t("validation.required")),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const googleAuthSchema = z.object({
  credential: z.string().min(10),
  birthDate: birthDateSchema.optional(),
  acceptPrivacy: z.boolean().optional(),
  timezone: z.string().max(64).optional(),
});

export const tokenSchema = z.object({ token: z.string().min(10) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ token: z.string().min(10), password: passwordSchema });

export const profileUpdateSchema = z.object({
  name: nameSchema.optional(),
  birthDate: birthDateSchema.optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  timezone: z.string().max(64).optional(),
});

export const settingsSchema = z.object({
  alertsEnabled: z.boolean(),
  alertSound: z.enum(ALERT_SOUNDS),
  alertVolume: z.number().min(0).max(1),
  endAlertMinutes: z.number().int().min(1).max(30),
  qpDurationSeconds: z
    .number()
    .refine((v) => (QP_DURATIONS as readonly number[]).includes(v), t("qp.invalidDuration"))
    .nullable(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const categorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

/** RF03.1/RF03.2 + RN04/RN06. A regra de sobreposição (RN05) e de data passada (RN15) roda na API. */
export const blockInputSchema = z
  .object({
    title: z.string().trim().min(1, t("validation.required")).max(120),
    description: z.string().trim().max(1000).nullable().optional(),
    categoryId: z.string().nullable().optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    recurrence: z.enum(RECURRENCES),
    date: dateSchema.nullable().optional(),
    repeatWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
    startsOn: dateSchema.nullable().optional(),
    startTime: timeSchema,
    endTime: timeSchema,
    isOneThing: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (isValidTime(value.startTime) && isValidTime(value.endTime)) {
      const error = validateBlockTimes(value.startTime, value.endTime);
      if (error === "endAfterStart") {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: t("block.endAfterStart") });
      } else if (error === "minDuration") {
        ctx.addIssue({ code: "custom", path: ["endTime"], message: t("block.minDuration") });
      }
    }
    if (value.recurrence === "ONCE" && !value.date) {
      ctx.addIssue({ code: "custom", path: ["date"], message: t("block.dateRequired") });
    }
    if (value.recurrence === "REPEAT") {
      if (!value.repeatWeekdays.length) {
        ctx.addIssue({ code: "custom", path: ["repeatWeekdays"], message: t("block.weekdaysRequired") });
      }
      if (!value.startsOn) {
        ctx.addIssue({ code: "custom", path: ["startsOn"], message: t("block.dateRequired") });
      }
    }
  });
export type BlockInput = z.infer<typeof blockInputSchema>;

export const copyDaySchema = z.object({ fromDate: dateSchema, toDate: dateSchema });

export const blockLogSchema = z.object({ status: z.enum(BLOCK_LOG_STATUSES) });

export const qpStartSchema = z.object({
  plannedSeconds: z
    .number()
    .refine((v) => (QP_DURATIONS as readonly number[]).includes(v), t("qp.invalidDuration")),
});
export const qpEndSchema = z.object({ actualSeconds: z.number().int().min(0).max(3600) });

export const rangeQuerySchema = z.object({ from: dateSchema, to: dateSchema });

// ---------- Admin ----------

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(USER_STATUSES).optional(),
  loginType: z.enum(["email", "google"]).optional(),
  createdFrom: dateSchema.optional(),
  createdTo: dateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminStatusSchema = z.object({ status: z.enum(["ACTIVE", "BLOCKED"]) });
export const adminResendSchema = z.object({ type: z.enum(["verify", "reset"]) });

export const reportQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  ageGroup: z.string().optional(),
  format: z.enum(["json", "csv", "pdf"]).default("json"),
});
