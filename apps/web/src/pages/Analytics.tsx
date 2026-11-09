import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  weekdayOf,
  type BlockSummaryDay,
  type CompassTodayDTO,
  type QpSummaryDay,
} from "@compasso/shared";
import { Button, Card, CardContent, CardHeader, CardTitle, cn } from "@compasso/ui";
import { api } from "../lib/api";
import { WEEKDAY_LABELS } from "../lib/time";

const PERIODS = [7, 30] as const;
type Period = (typeof PERIODS)[number];

/** Rótulo do eixo: dia da semana na visão de 7 dias; dia do mês (a cada 5) na de 30. */
function axisLabel(date: string, index: number, period: Period, count: number) {
  if (period === 7) return WEEKDAY_LABELS[weekdayOf(date)];
  return index % 5 === 0 || index === count - 1 ? String(Number(date.slice(8, 10))) : "";
}

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const percent = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

/** Analytics — conclusão dos blocos por dia e Repetições QP (RF04.11, RF05.6 / RF05.7). */
export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>(7);
  const { data: today } = useQuery({ queryKey: ["compass"], queryFn: () => api.get<CompassTodayDTO>("/compass/today") });
  const to = today?.date;
  const from = to ? addDays(to, -(period - 1)) : undefined;

  const { data: blockDays = [] } = useQuery({
    queryKey: ["blocks-summary", from, to],
    queryFn: () => api.get<BlockSummaryDay[]>(`/blocks/summary?from=${from}&to=${to}`),
    enabled: !!to,
  });
  const { data: qpDays = [] } = useQuery({
    queryKey: ["qp-summary", from, to],
    queryFn: () => api.get<QpSummaryDay[]>(`/qp-sessions/summary?from=${from}&to=${to}`),
    enabled: !!to,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">Analytics</h1>
          <p className="mt-1 text-muted-foreground">Como seus dias têm saído do plano e quantas Repetições QP você fez.</p>
        </div>
        <div role="group" aria-label="Período" className="flex gap-1 rounded-lg border bg-card p-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={period === p ? "secondary" : "ghost"}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {p} dias
            </Button>
          ))}
        </div>
      </div>

      <BlockCompletionCard days={blockDays} period={period} />
      <QpCard days={qpDays} period={period} />
    </div>
  );
}

const SEGMENTS = [
  { key: "done", label: "Concluído", className: "bg-status-done" },
  { key: "partial", label: "Parcial", className: "bg-status-partial" },
  { key: "skipped", label: "Não realizado", className: "bg-status-skipped" },
] as const;

function BlockCompletionCard({ days, period }: { days: BlockSummaryDay[]; period: Period }) {
  const totals = days.reduce(
    (s, d) => ({
      planned: s.planned + d.planned,
      done: s.done + d.done,
      partial: s.partial + d.partial,
      skipped: s.skipped + d.skipped,
    }),
    { planned: 0, done: 0, partial: 0, skipped: 0 },
  );
  const unmarked = totals.planned - totals.done - totals.partial - totals.skipped;
  const max = Math.max(1, ...days.map((d) => d.planned));

  const stats = [
    { label: "Taxa de conclusão", value: `${percent(totals.done, totals.planned)}%` },
    { label: "Concluídos", value: totals.done, swatch: "bg-status-done" },
    { label: "Parciais", value: totals.partial, swatch: "bg-status-partial" },
    { label: "Não realizados", value: totals.skipped, swatch: "bg-status-skipped" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conclusão dos blocos</CardTitle>
        <p className="text-sm text-muted-foreground">
          {totals.planned} {totals.planned === 1 ? "bloco planejado" : "blocos planejados"} nos últimos {period} dias
          {unmarked > 0 && ` · ${unmarked} sem registro`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {s.swatch && <span className={cn("size-2.5 rounded-full", s.swatch)} aria-hidden />}
                {s.label}
              </dt>
              <dd className="mt-1 text-2xl tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>

        <ol className="flex h-48 items-end gap-1 sm:gap-2" aria-label="Blocos por dia">
          {days.map((d, i) => {
            const rate = percent(d.done, d.planned);
            const unmarkedDay = d.planned - d.done - d.partial - d.skipped;
            return (
              <li key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                {period === 7 && (
                  <span className="text-xs tabular-nums text-muted-foreground">{d.planned ? `${rate}%` : "–"}</span>
                )}
                <div
                  className="flex w-full flex-col-reverse overflow-hidden rounded-t-md transition-[height] duration-300"
                  style={{ height: `${(d.planned / max) * 128}px`, minHeight: d.planned ? 4 : 0 }}
                  title={`${shortDate(d.date)}: ${d.done} concluídos, ${d.partial} parciais, ${d.skipped} não realizados, ${unmarkedDay} sem registro`}
                  aria-hidden
                >
                  {SEGMENTS.map((seg) =>
                    d[seg.key] ? <div key={seg.key} className={seg.className} style={{ flexGrow: d[seg.key] }} /> : null,
                  )}
                  {unmarkedDay > 0 && (
                    <div className="border border-dashed border-muted-foreground/40 bg-muted" style={{ flexGrow: unmarkedDay }} />
                  )}
                </div>
                {!d.planned && <div className="h-1 w-full rounded-t-md bg-muted" aria-hidden />}
                <span className="h-4 text-xs text-muted-foreground">{axisLabel(d.date, i, period, days.length)}</span>
                <span className="sr-only">
                  {d.date}: {d.planned} planejados, {d.done} concluídos, {d.partial} parciais, {d.skipped} não realizados,{" "}
                  {unmarkedDay} sem registro
                </span>
              </li>
            );
          })}
        </ol>

        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
          {SEGMENTS.map((seg) => (
            <li key={seg.key} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-sm", seg.className)} aria-hidden /> {seg.label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm border border-dashed border-muted-foreground/40 bg-muted" aria-hidden /> Sem
            registro
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function QpCard({ days, period }: { days: QpSummaryDay[]; period: Period }) {
  const max = Math.max(3, ...days.map((d) => d.completed));
  const total = days.reduce((s, d) => s + d.completed, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Repetições QP</CardTitle>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "repetição concluída" : "repetições concluídas"} nos últimos {period} dias
        </p>
      </CardHeader>
      <CardContent>
        <ol className="flex h-40 items-end gap-1 sm:gap-2" aria-label="Repetições por dia">
          {days.map((d, i) => (
            <li key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              {period === 7 && <span className="text-xs tabular-nums">{d.completed}</span>}
              <div
                className="w-full rounded-t-md bg-secondary transition-[height] duration-300"
                style={{ height: `${(d.completed / max) * 100}px`, minHeight: 4 }}
                title={`${shortDate(d.date)}: ${d.completed} concluídas, ${d.incomplete} incompletas`}
                aria-hidden
              />
              <span className="h-4 text-xs text-muted-foreground">{axisLabel(d.date, i, period, days.length)}</span>
              <span className="sr-only">
                {d.date}: {d.completed} concluídas, {d.incomplete} incompletas
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
