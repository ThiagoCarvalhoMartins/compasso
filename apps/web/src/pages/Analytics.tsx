import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TriangleAlert, X } from "lucide-react";
import {
  addDays,
  weekdayOf,
  type BlockLogStatus,
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

/** Abaixo desta taxa de conclusão (%), o Analytics sugere rever os blocos. */
const LOW_COMPLETION_RATE = 70;

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
  { key: "done", status: "DONE", label: "Concluído", plural: "Concluídos", className: "bg-status-done" },
  { key: "partial", status: "PARTIAL", label: "Parcial", plural: "Parciais", className: "bg-status-partial" },
  { key: "skipped", status: "SKIPPED", label: "Não realizado", plural: "Não realizados", className: "bg-status-skipped" },
] as const satisfies readonly { key: string; status: BlockLogStatus; label: string; plural: string; className: string }[];

type SegmentKey = (typeof SEGMENTS)[number]["key"];

function BlockCompletionCard({ days, period }: { days: BlockSummaryDay[]; period: Period }) {
  const [selected, setSelected] = useState<SegmentKey | null>(null);
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
  const completionRate = percent(totals.done, totals.planned);
  const lowCompletion = totals.planned > 0 && completionRate < LOW_COMPLETION_RATE;

  const selectedSegment = SEGMENTS.find((seg) => seg.key === selected);

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
        {lowCompletion && (
          <div role="alert" className="flex gap-3 rounded-lg bg-destructive/25 p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-medium">Taxa de conclusão baixa ({completionRate}%).</span> Menos de{" "}
              {LOW_COMPLETION_RATE}% dos seus blocos foram concluídos nos últimos {period} dias. Considere ajustar seus
              blocos na{" "}
              <Link to="/agenda" className="font-medium underline underline-offset-2">
                Agenda
              </Link>{" "}
              — duração, horário ou quantidade — para deixar o plano mais próximo do seu ritmo e melhorar a taxa.
            </p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Taxa de conclusão</p>
            <p className="mt-1 text-2xl tabular-nums">{completionRate}%</p>
          </div>
          {SEGMENTS.map((seg) => {
            const active = selected === seg.key;
            return (
              <div
                key={seg.key}
                className={cn(
                  "relative rounded-lg border transition-colors",
                  active ? "border-foreground/40 bg-muted" : "hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  className="w-full rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={active}
                  aria-controls="block-completion-detail"
                  onClick={() => setSelected(active ? null : seg.key)}
                >
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-2.5 rounded-full", seg.className)} aria-hidden />
                    {seg.plural}
                  </span>
                  <span className="mt-1 block text-2xl tabular-nums">{totals[seg.key]}</span>
                </button>
                {active && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1 size-7"
                    aria-label="Fechar e voltar ao gráfico"
                    title="Voltar ao gráfico"
                    onClick={() => setSelected(null)}
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {selectedSegment ? (
          <BlockList id="block-completion-detail" days={days} segment={selectedSegment} />
        ) : (
          <BlockChart days={days} period={period} max={max} />
        )}
      </CardContent>
    </Card>
  );
}

/** Blocos com o status escolhido, do dia mais recente para o mais antigo. */
function BlockList({ id, days, segment }: { id: string; days: BlockSummaryDay[]; segment: (typeof SEGMENTS)[number] }) {
  const groups = days
    .map((d) => ({ date: d.date, blocks: d.marked.filter((b) => b.status === segment.status) }))
    .filter((g) => g.blocks.length)
    .reverse();

  if (!groups.length) {
    return (
      <p id={id} className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum bloco {segment.label.toLowerCase()} no período.
      </p>
    );
  }

  return (
    <div id={id} className="flex max-h-80 flex-col gap-4 overflow-y-auto pr-1" aria-label={`Blocos ${segment.plural.toLowerCase()}`}>
      {groups.map((g) => (
        <section key={g.date} className="flex flex-col gap-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">
            {WEEKDAY_LABELS[weekdayOf(g.date)]}, {shortDate(g.date)}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {g.blocks.map((b) => (
              <li key={b.blockId} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <span className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: b.color }} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{b.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {b.startTime}–{b.endTime}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function BlockChart({ days, period, max }: { days: BlockSummaryDay[]; period: Period; max: number }) {
  return (
    <>
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
    </>
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
