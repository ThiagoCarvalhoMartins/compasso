import type { Block, Category, User, UserSettings } from "@prisma/client";
import {
  parseWeekdays,
  type AlertSound,
  type BlockDTO,
  type CategoryDTO,
  type QpDuration,
  type SettingsDTO,
  type UserDTO,
} from "@compasso/shared";
import { fromDbDate, fromDbTime } from "./time";

export const toUserDTO = (u: User): UserDTO => ({
  id: u.id,
  name: u.name,
  email: u.email,
  birthDate: u.birthDate ? fromDbDate(u.birthDate) : null,
  avatarUrl: u.avatarUrl,
  timezone: u.timezone,
  role: u.role,
  status: u.status,
  emailVerified: !!u.emailVerifiedAt,
  hasPassword: !!u.passwordHash,
  hasGoogle: !!u.googleId,
});

export const toBlockDTO = (b: Block): BlockDTO => ({
  id: b.id,
  categoryId: b.categoryId,
  title: b.title,
  description: b.description,
  recurrence: b.recurrence,
  date: b.date ? fromDbDate(b.date) : null,
  repeatWeekdays: parseWeekdays(b.repeatWeekdays),
  startsOn: b.startsOn ? fromDbDate(b.startsOn) : null,
  endsOn: b.endsOn ? fromDbDate(b.endsOn) : null,
  excludedDates: b.excludedDates ? b.excludedDates.split(",") : [],
  startTime: fromDbTime(b.startTime),
  endTime: fromDbTime(b.endTime),
  color: b.color,
  isOneThing: b.isOneThing,
});

export const toCategoryDTO = (c: Category): CategoryDTO => ({
  id: c.id,
  name: c.name,
  color: c.color,
  isDefault: c.userId === null,
});

export const toSettingsDTO = (s: UserSettings): SettingsDTO => ({
  alertsEnabled: s.alertsEnabled,
  alertSound: s.alertSound as AlertSound,
  alertVolume: s.alertVolume,
  endAlertMinutes: s.endAlertMinutes,
  qpDurationSeconds: s.qpDurationSeconds as QpDuration | null,
});
