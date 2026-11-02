import type { AlertSound, BlockLogStatus, QpDuration, Recurrence, Role, UserStatus } from "./constants";

/** Bloco como trafega na API (horários em hora local HH:MM — RN09). */
export interface BlockDTO {
  id: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  recurrence: Recurrence;
  /** YYYY-MM-DD, apenas para ONCE. */
  date: string | null;
  /** 0 = domingo … 6 = sábado, apenas para REPEAT. */
  repeatWeekdays: number[];
  /** YYYY-MM-DD, apenas para REPEAT. */
  startsOn: string | null;
  startTime: string;
  endTime: string;
  color: string;
  isOneThing: boolean;
}

export interface BlockLogDTO {
  blockId: string;
  date: string;
  status: BlockLogStatus;
}

export interface CategoryDTO {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  birthDate: string | null;
  avatarUrl: string | null;
  timezone: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export interface SettingsDTO {
  alertsEnabled: boolean;
  alertSound: AlertSound;
  alertVolume: number;
  endAlertMinutes: number;
  qpDurationSeconds: QpDuration | null;
}

export interface CompassTodayDTO {
  date: string;
  timezone: string;
  blocks: (BlockDTO & { log: BlockLogStatus | null })[];
  settings: SettingsDTO;
  qpToday: number;
}

export interface QpSummaryDay {
  date: string;
  completed: number;
  incomplete: number;
}

export interface AuthResponse {
  accessToken: string;
  user: UserDTO;
}
