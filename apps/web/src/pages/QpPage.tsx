import { useQuery } from "@tanstack/react-query";
import { addDays, type CompassTodayDTO, type QpSummaryDay } from "@compasso/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@compasso/ui";
import { QpLauncher } from "../components/Qp";
import { api } from "../lib/api";
import { WEEKDAY_LABELS } from "../lib/time";
import { weekdayOf } from "@compasso/shared";

/** RF05.6 / RF05.7 — contador do dia e histórico semanal. */
export function QpPage() {
  const { data: today } = useQuery({ queryKey: ["compass"], queryFn: () => api.get<CompassTodayDTO>("/compass/today") });
  const to = today?.date;
  const from = to ? addDays(to, -6) : undefined;
  const { data: week = [] } = useQuery({
    queryKey: ["qp-summary", from, to],
    queryFn: () => api.get<QpSummaryDay[]>(`/qp-sessions/summary?from=${from}&to=${to}`),
    enabled: !!to,
  });
  const max = Math.max(3, ...week.map((d) => d.completed));
  const total = week.reduce((s, d) => s + d.completed, 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl md:text-4xl">Repetições QP</h1>
        <p className="mt-1 text-muted-foreground">
          Exercícios curtos de atenção plena, inspirados em <em>Inteligência Positiva</em>: cada repetição fortalece o Sábio
          e enfraquece os Sabotadores.
        </p>
      </div>

      {today && <QpLauncher settings={today.settings} qpToday={today.qpToday} />}

      <Card>
        <CardHeader>
          <CardTitle>Últimos 7 dias</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "repetição concluída" : "repetições concluídas"}
          </p>
        </CardHeader>
        <CardContent>
          <ol className="flex h-40 items-end gap-2" aria-label="Repetições por dia">
            {week.map((d) => (
              <li key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs tabular-nums">{d.completed}</span>
                <div
                  className="w-full rounded-t-md bg-secondary transition-[height] duration-300"
                  style={{ height: `${(d.completed / max) * 100}px`, minHeight: 4 }}
                  aria-hidden
                />
                <span className="text-xs text-muted-foreground">{WEEKDAY_LABELS[weekdayOf(d.date)]}</span>
                <span className="sr-only">
                  {d.date}: {d.completed} concluídas, {d.incomplete} incompletas
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
