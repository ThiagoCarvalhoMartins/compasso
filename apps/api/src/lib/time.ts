/** Conversões entre os tipos DATE/TIME do MySQL (que o Prisma devolve como Date em UTC) e strings locais. */

export const toDbDate = (date: string) => new Date(`${date}T00:00:00Z`);
export const fromDbDate = (value: Date) => value.toISOString().slice(0, 10);

export const toDbTime = (time: string) => new Date(`1970-01-01T${time}:00Z`);
export const fromDbTime = (value: Date) => value.toISOString().slice(11, 16);

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Data de hoje (YYYY-MM-DD) no fuso do usuário — RN09/RN12. */
export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Instantes UTC de início e fim de um dia local, para filtrar colunas DATETIME (ex.: sessões QP). */
export function dayBoundsUtc(date: string, tz: string): { start: Date; end: Date } {
  const offset = (d: Date) => {
    const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
    const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
    return local.getTime() - utc.getTime();
  };
  const guess = new Date(`${date}T00:00:00Z`);
  const start = new Date(guess.getTime() - offset(guess));
  const nextGuess = new Date(guess.getTime() + 86_400_000);
  const end = new Date(nextGuess.getTime() - offset(nextGuess));
  return { start, end };
}
