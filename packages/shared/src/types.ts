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
  /** YYYY-MM-DD, último dia da série; nulo = sem término. Apenas para REPEAT. */
  endsOn: string | null;
  /** Dias (YYYY-MM-DD) excluídos individualmente da série. Apenas para REPEAT. */
  excludedDates: string[];
  startTime: string;
  endTime: string;
  color: string;
  isOneThing: boolean;
  /** Versão de 2 minutos: o mínimo que já conta como não ter desistido (Hábitos Atômicos). */
  minimumVersion: string | null;
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
  blocks: (BlockDTO & {
    log: BlockLogStatus | null;
    /**
     * Nunca falhe duas vezes: quantas ocorrências seguidas, antes de hoje, ficaram como "Não realizado" ou sem
     * registro (0 = a última foi concluída ou parcial). Só para recorrentes.
     */
    previousMisses: number;
    /** Data da ocorrência anterior do recorrente (YYYY-MM-DD), quando houver. */
    previousDate: string | null;
  })[];
  settings: SettingsDTO;
  qpToday: number;
}

export interface QpSummaryDay {
  date: string;
  completed: number;
  incomplete: number;
}

/** Média das notas de energia numa hora do dia (0–23, no fuso do usuário); null quando não há registro. */
export interface EnergyHour {
  hour: number;
  average: number | null;
  count: number;
}

/** Bloco marcado num dia do resumo do Analytics. */
export interface BlockSummaryEntry {
  blockId: string;
  title: string;
  color: string;
  startTime: string;
  endTime: string;
  status: BlockLogStatus;
}

/** Blocos planejados no dia e como foram marcados (RF04.11); planned − done − partial − skipped = sem registro. */
export interface BlockSummaryDay {
  date: string;
  planned: number;
  done: number;
  partial: number;
  skipped: number;
  /** Parciais que vieram da versão de 2 minutos. */
  viaMinimum: number;
  /** Blocos concluídos ou parciais logo depois de uma ocorrência que falhou (nunca falhe duas vezes). */
  comebacks: number;
  /** Os blocos marcados no dia (concluídos, parciais e não realizados), pela ordem de início. */
  marked: BlockSummaryEntry[];
}

export interface AuthResponse {
  accessToken: string;
  user: UserDTO;
}
