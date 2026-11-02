import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

/** Data local (YYYY-MM-DD) e segundo do dia no fuso do perfil (RN09). */
export function zonedNow(epochMs: number, timezone: string) {
  const date = formatInTimeZone(epochMs, timezone, "yyyy-MM-dd");
  const [h, m, s] = formatInTimeZone(epochMs, timezone, "HH:mm:ss").split(":").map(Number);
  return { date, secondOfDay: h * 3600 + m * 60 + s };
}

/** Instante real de "HH:MM" numa data local — já considera horário de verão. */
export function localTimeToEpoch(date: string, time: string, timezone: string): number {
  return fromZonedTime(`${date}T${time}:00`, timezone).getTime();
}

export function formatLongDate(date: string): string {
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), "UTC", "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function formatShortDate(date: string): string {
  return formatInTimeZone(new Date(`${date}T12:00:00Z`), "UTC", "EEE, d/MM", { locale: ptBR });
}

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "1h 05min" / "12min" */
export function humanDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}
