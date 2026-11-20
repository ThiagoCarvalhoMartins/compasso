import { MIN_BLOCK_MINUTES, type BlockLogStatus } from "./constants";
import type { BlockDTO, BlockSummaryDay, EnergyHour } from "./types";

/** Campos de bloco que as regras de agenda precisam. */
export type BlockLike = Pick<
  BlockDTO,
  "recurrence" | "date" | "repeatWeekdays" | "startsOn" | "startTime" | "endTime"
> & { id?: string; title?: string; isOneThing?: boolean; endsOn?: string | null; excludedDates?: string[] };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "09:30" → 570 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Dia da semana (0 = domingo) de uma data YYYY-MM-DD, sem depender do fuso da máquina. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Soma dias a uma data YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Datas (inclusive) entre from e to. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Segunda-feira da semana de uma data. */
export function startOfWeek(date: string): string {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

/** RN02: idade completa em anos numa data de referência (ambas YYYY-MM-DD). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

export function ageGroup(age: number): string {
  if (age < 18) return "13–17";
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 60) return "45–59";
  return "60+";
}

export type BlockTimeError = "endAfterStart" | "minDuration";

/** RN04 e RN06: fim depois do início (sem atravessar a meia-noite) e duração mínima. */
export function validateBlockTimes(startTime: string, endTime: string): BlockTimeError | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (end <= start) return "endAfterStart";
  if (end - start < MIN_BLOCK_MINUTES) return "minDuration";
  return null;
}

/**
 * O bloco vale nesta data? (ONCE: data exata; REPEAT: dia da semana marcado a partir de starts_on — RN16 —
 * até ends_on, se houver, e fora dos dias excluídos individualmente.)
 */
export function blockAppliesOn(block: BlockLike, date: string): boolean {
  if (block.recurrence === "ONCE") return block.date === date;
  return (
    !!block.startsOn &&
    block.startsOn <= date &&
    (!block.endsOn || date <= block.endsOn) &&
    block.repeatWeekdays.includes(weekdayOf(date)) &&
    !block.excludedDates?.includes(date)
  );
}

/** A série ainda acontece em algum dia? Sem término, sempre: as exclusões são finitas. */
export function seriesHasOccurrences(block: BlockLike): boolean {
  if (block.recurrence === "ONCE") return true;
  if (!block.startsOn || !block.repeatWeekdays.length) return false;
  if (!block.endsOn) return true;
  return dateRange(block.startsOn, block.endsOn).some((d) => blockAppliesOn(block, d));
}

/**
 * Ocorrência anterior de um recorrente antes de `date` (exclusive), respeitando dias da semana, início, fim e
 * dias excluídos da série. `notBefore` ignora dias anteriores à criação do bloco. Nulo para ONCE ou sem anterior.
 */
export function previousOccurrence(block: BlockLike, date: string, notBefore?: string): string | null {
  if (block.recurrence !== "REPEAT" || !block.startsOn || !block.repeatWeekdays.length) return null;
  const floor = notBefore && notBefore > block.startsOn ? notBefore : block.startsOn;
  // Exclusões são finitas, mas uma série muito recortada pode pular semanas: olha até um ano para trás.
  for (let d = addDays(date, -1), i = 0; d >= floor && i < 366; d = addDays(d, -1), i++) {
    if (blockAppliesOn(block, d)) return d;
  }
  return null;
}

/** Falhou = "Não realizado" ou sem registro. Parcial não é falha: fazer pouco já conta. */
export const isMiss = (status: BlockLogStatus | null | undefined) => !status || status === "SKIPPED";

/**
 * Nunca falhe duas vezes: quantas ocorrências seguidas antes de `date` falharam (até `limit`).
 * `statusOf(dia)` devolve o registro do bloco naquele dia.
 */
export function consecutiveMisses(
  block: BlockLike,
  date: string,
  statusOf: (day: string) => BlockLogStatus | null | undefined,
  { notBefore, limit = 7 }: { notBefore?: string; limit?: number } = {},
): { misses: number; previousDate: string | null } {
  const previousDate = previousOccurrence(block, date, notBefore);
  let misses = 0;
  for (let d = previousDate; d && misses < limit && isMiss(statusOf(d)); d = previousOccurrence(block, d, notBefore)) {
    misses++;
  }
  return { misses, previousDate };
}

/** Monta o dia: recorrentes que valem na data + blocos ONCE da data, ordenados pelo início. */
export function blocksForDate<T extends BlockLike>(blocks: T[], date: string): T[] {
  return blocks
    .filter((b) => blockAppliesOn(b, date))
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Resumo diário dos blocos para o Analytics: quantos estavam planejados em cada dia e como foram marcados.
 * Só contam os logs de blocos que valem no dia; o que não foi marcado entra como "sem registro".
 */
export function summarizeBlockDays(
  blocks: (BlockLike & { id: string; title: string; color: string })[],
  logs: { blockId: string; date: string; status: BlockLogStatus; viaMinimum?: boolean }[],
  days: string[],
  {
    createdOn,
    logsFrom,
  }: {
    /** Dia de criação de cada bloco: ocorrências anteriores a ele não contam como falha. */
    createdOn?: Map<string, string>;
    /** Primeiro dia coberto por `logs`; antes dele o registro é desconhecido e não conta para as retomadas. */
    logsFrom?: string;
  } = {},
): BlockSummaryDay[] {
  const byKey = new Map(logs.map((l) => [`${l.blockId}|${l.date}`, l]));
  return days.map((date) => {
    const day: BlockSummaryDay = { date, planned: 0, done: 0, partial: 0, skipped: 0, viaMinimum: 0, comebacks: 0, marked: [] };
    for (const b of blocksForDate(blocks, date)) {
      day.planned++;
      const log = byKey.get(`${b.id}|${date}`);
      const status = log?.status;
      if (!status) continue;
      if (status === "DONE") day.done++;
      else if (status === "PARTIAL") day.partial++;
      else if (status === "SKIPPED") day.skipped++;
      if (status === "PARTIAL" && log.viaMinimum) day.viaMinimum++;
      if (status !== "SKIPPED") {
        const previous = previousOccurrence(b, date, createdOn?.get(b.id));
        if (previous && (!logsFrom || previous >= logsFrom) && isMiss(byKey.get(`${b.id}|${previous}`)?.status)) {
          day.comebacks++;
        }
      }
      const { id: blockId, title, color, startTime, endTime } = b;
      day.marked.push({ blockId, title, color, startTime, endTime, status });
    }
    return day;
  });
}

/** Os dois blocos podem cair no mesmo dia? */
export function blocksShareADay(a: BlockLike, b: BlockLike): boolean {
  if (a.recurrence === "ONCE" && b.recurrence === "ONCE") return a.date === b.date;
  if (a.recurrence === "ONCE") return !!a.date && blockAppliesOn(b, a.date);
  if (b.recurrence === "ONCE") return !!b.date && blockAppliesOn(a, b.date);
  const lastDay = a.endsOn && b.endsOn ? (a.endsOn < b.endsOn ? a.endsOn : b.endsOn) : (a.endsOn ?? b.endsOn);
  // Dois recorrentes sem data de término (RN16): basta compartilharem um dia da semana.
  if (!lastDay) return a.repeatWeekdays.some((d) => b.repeatWeekdays.includes(d));
  if (!a.startsOn || !b.startsOn) return false;
  const firstDay = a.startsOn > b.startsOn ? a.startsOn : b.startsOn;
  return dateRange(firstDay, lastDay).some((d) => blockAppliesOn(a, d) && blockAppliesOn(b, d));
}

export function timesOverlap(a: BlockLike, b: BlockLike): boolean {
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  );
}

/** RN05: primeiro bloco existente que se sobrepõe ao candidato (ignora o próprio bloco ao editar). */
export function findOverlap<T extends BlockLike>(candidate: BlockLike, existing: T[]): T | null {
  return (
    existing.find(
      (b) =>
        (candidate.id === undefined || b.id !== candidate.id) &&
        blocksShareADay(candidate, b) &&
        timesOverlap(candidate, b),
    ) ?? null
  );
}

/** RN10: outro bloco "A Única Coisa" que cairia no mesmo dia do candidato. */
export function findOneThingConflict<T extends BlockLike>(candidate: BlockLike, existing: T[]): T | null {
  if (!candidate.isOneThing) return null;
  return (
    existing.find(
      (b) =>
        b.isOneThing &&
        (candidate.id === undefined || b.id !== candidate.id) &&
        blocksShareADay(candidate, b),
    ) ?? null
  );
}

/** Horário sugerido para a Única Coisa. `average` é a energia média prevista; nulo sem dados suficientes. */
export interface FocusSlot {
  startTime: string;
  endTime: string;
  average: number | null;
}

/** Uma hora só entra na conta com pelo menos 3 registros: um dia bom isolado não vira "pico". */
export const FOCUS_MIN_CHECKS_PER_HOUR = 3;
/** Abaixo disso, a sugestão é só o próximo horário livre. */
export const FOCUS_MIN_CHECKS = 10;
const SLOT_STEP = 15;
const DAY_END = 23 * 60;

/**
 * Horas com energia confiável (média com registros suficientes). Vazio quando ainda não há dados bastantes
 * para falar em pico.
 */
export function reliableEnergyHours(hours: EnergyHour[]): Map<number, number> {
  const total = hours.reduce((s, h) => s + h.count, 0);
  const reliable = new Map<number, number>();
  if (total < FOCUS_MIN_CHECKS) return reliable;
  for (const h of hours) {
    if (h.average !== null && h.count >= FOCUS_MIN_CHECKS_PER_HOUR) reliable.set(h.hour, h.average);
  }
  return reliable.size >= 2 ? reliable : new Map();
}

/** As horas de maior energia (até `top`), da melhor para a pior. Só entram horas acima da média da própria pessoa. */
export function peakHours(hours: EnergyHour[], top = 3): number[] {
  const reliable = [...reliableEnergyHours(hours)];
  const mean = reliable.reduce((s, [, avg]) => s + avg, 0) / (reliable.length || 1);
  return reliable
    .filter(([, avg]) => avg > mean)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, top)
    .map(([hour]) => hour);
}

/**
 * Sugere onde encaixar a Única Coisa hoje: o espaço livre (sem sobrepor blocos) a partir de `fromMinute` com
 * a maior energia média nas horas que cobre. Tenta `duration` e, se não couber, durações menores (até 30 min).
 * Sem dados confiáveis de energia, devolve o próximo espaço livre. Nulo se nada couber até as 23h.
 */
export function suggestFocusSlot(
  dayBlocks: Pick<BlockLike, "startTime" | "endTime">[],
  hours: EnergyHour[],
  fromMinute: number,
  duration = 90,
): FocusSlot | null {
  const busy = dayBlocks
    .map((b) => [timeToMinutes(b.startTime), timeToMinutes(b.endTime)] as const)
    .sort((a, b) => a[0] - b[0]);
  const isFree = (start: number, end: number) => busy.every(([s, e]) => end <= s || start >= e);
  const reliable = reliableEnergyHours(hours);
  const known = [...reliable.values()];
  const mean = known.length ? known.reduce((s, v) => s + v, 0) / known.length : 0;
  // Média ponderada pelos minutos de cada hora coberta; horas sem dados entram com a média geral.
  const score = (start: number, end: number) => {
    let sum = 0;
    for (let m = start; m < end; m++) sum += reliable.get(Math.floor(m / 60)) ?? mean;
    return sum / (end - start);
  };
  const first = Math.ceil(fromMinute / SLOT_STEP) * SLOT_STEP;

  for (const length of [...new Set([duration, 60, 45, 30])].filter((l) => l <= duration)) {
    let best: { start: number; score: number } | null = null;
    for (let start = first; start + length <= DAY_END; start += SLOT_STEP) {
      if (!isFree(start, start + length)) continue;
      if (!reliable.size) return { startTime: minutesToTime(start), endTime: minutesToTime(start + length), average: null };
      const s = score(start, start + length);
      if (!best || s > best.score + 1e-9) best = { start, score: s };
    }
    if (best) {
      return {
        startTime: minutesToTime(best.start),
        endTime: minutesToTime(best.start + length),
        average: Math.round(best.score * 10) / 10,
      };
    }
  }
  return null;
}

export type AlertKind = "start" | "end";

export interface PlannedAlert<T> {
  kind: AlertKind;
  /** Minuto do dia em que o alerta toca. */
  minute: number;
  block: T;
}

/**
 * Alertas do dia, já com as regras de conflito:
 * - RN07: bloco que dura até a antecedência do aviso (padrão 5 min) não tem alerta de fim.
 * - RN08: se um alerta de fim cair no mesmo minuto de um início, toca só o de início.
 */
export function planAlerts<T extends BlockLike>(dayBlocks: T[], endAlertMinutes: number): PlannedAlert<T>[] {
  const starts: PlannedAlert<T>[] = dayBlocks.map((block) => ({
    kind: "start",
    minute: timeToMinutes(block.startTime),
    block,
  }));
  const startMinutes = new Set(starts.map((a) => a.minute));
  const ends: PlannedAlert<T>[] = [];
  for (const block of dayBlocks) {
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    if (end - start <= endAlertMinutes) continue;
    const minute = end - endAlertMinutes;
    if (startMinutes.has(minute)) continue;
    ends.push({ kind: "end", minute, block });
  }
  return [...starts, ...ends].sort((a, b) => a.minute - b.minute || (a.kind === "start" ? -1 : 1));
}

export interface CompassState<T> {
  current: T | null;
  next: T | null;
  /** 0–1 dentro do bloco atual. */
  currentProgress: number;
  /** Segundos até o fim do bloco atual. */
  secondsToCurrentEnd: number | null;
  /** Segundos até o início do próximo bloco. */
  secondsToNext: number | null;
  /** RF04.6: 0–1 do início do primeiro bloco ao fim do último. */
  dayProgress: number;
  isFreeTime: boolean;
}

/** Estado da tela Compasso a partir do segundo do dia (sempre recalculado do relógio, nunca somando ticks). */
export function compassState<T extends BlockLike>(dayBlocks: T[], secondOfDay: number): CompassState<T> {
  const sorted = [...dayBlocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const sec = (time: string) => timeToMinutes(time) * 60;
  const current = sorted.find((b) => sec(b.startTime) <= secondOfDay && secondOfDay < sec(b.endTime)) ?? null;
  const next = sorted.find((b) => sec(b.startTime) > secondOfDay) ?? null;

  let dayProgress = 0;
  if (sorted.length) {
    const first = sec(sorted[0].startTime);
    const last = Math.max(...sorted.map((b) => sec(b.endTime)));
    dayProgress = Math.min(1, Math.max(0, (secondOfDay - first) / (last - first)));
  }

  return {
    current,
    next,
    currentProgress: current
      ? (secondOfDay - sec(current.startTime)) / (sec(current.endTime) - sec(current.startTime))
      : 0,
    secondsToCurrentEnd: current ? sec(current.endTime) - secondOfDay : null,
    secondsToNext: next ? sec(next.startTime) - secondOfDay : null,
    dayProgress,
    isFreeTime: current === null,
  };
}

/** 3725 → "1:02:05"; 125 → "2:05" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(r).padStart(2, "0")}`;
}

/** Converte "1,3,5" ⇄ [1,3,5] (formato de armazenamento de repeat_weekdays). */
export function parseWeekdays(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function serializeWeekdays(days: number[]): string {
  return [...new Set(days)].sort().join(",");
}
