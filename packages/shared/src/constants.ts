/** RN14: durações aceitas para a Repetição QP (segundos). */
export const QP_DURATIONS = [10, 15, 20, 30] as const;
export type QpDuration = (typeof QP_DURATIONS)[number];
/** RN14: o dropdown abre com 15 s no primeiro uso. */
export const QP_DEFAULT_DURATION: QpDuration = 15;

/** RN04: duração mínima de um bloco. */
export const MIN_BLOCK_MINUTES = 5;
/** RN02: idade mínima para cadastro. */
export const MIN_AGE = 13;
/** RN02: abaixo desta idade valem as regras de consentimento da LGPD para menores. */
export const ADULT_AGE = 18;
/** RF02.3: antecedência padrão do aviso de fim. */
export const DEFAULT_END_ALERT_MINUTES = 5;

export const ALERT_SOUNDS = ["sino", "tigela", "suave"] as const;
export type AlertSound = (typeof ALERT_SOUNDS)[number];

/** Dias da semana no padrão do JavaScript: 0 = domingo … 6 = sábado. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const RECURRENCES = ["ONCE", "REPEAT"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

/** Ao excluir um dia de um bloco recorrente: só aquele dia ou ele e os seguintes. */
/** Parte de um recorrente afetada ao excluir ou editar: só o dia, ou ele e os seguintes. */
export const BLOCK_SCOPES = ["single", "following"] as const;
export type BlockScope = (typeof BLOCK_SCOPES)[number];

export const BLOCK_LOG_STATUSES =["DONE", "PARTIAL", "SKIPPED"] as const;
export type BlockLogStatus = (typeof BLOCK_LOG_STATUSES)[number];

export const ROLES = ["USER", "SUPPORT", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "BLOCKED", "DELETED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Paleta da identidade visual (cores dos blocos por categoria). */
export const PALETTE = {
  trabalho: "#B9D3E3",
  estudo: "#F4C9B0",
  saude: "#BFE3D0",
  pessoal: "#EBC3C8",
  salvia: "#A8C3A0",
  lavanda: "#C7BEDF",
  manteiga: "#F3E1A6",
} as const;

/** Categorias padrão do sistema (categories.user_id nulo). */
export const DEFAULT_CATEGORIES = [
  { name: "Trabalho", color: PALETTE.trabalho },
  { name: "Estudo", color: PALETTE.estudo },
  { name: "Saúde", color: PALETTE.saude },
  { name: "Pessoal", color: PALETTE.pessoal },
] as const;

export const BLOCK_COLORS = Object.values(PALETTE);
