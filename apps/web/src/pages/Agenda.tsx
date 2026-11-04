import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, ClipboardCopy, Copy, Plus, Repeat, Star } from "lucide-react";
import { addDays, blocksForDate, startOfWeek, weekdayOf, type BlockDTO } from "@compasso/shared";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  cn,
  toast,
} from "@compasso/ui";
import { BlockFormDialog, type BlockDraft } from "../components/BlockFormDialog";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { WEEKDAY_LABELS, formatShortDate, zonedNow } from "../lib/time";

/** RF03.4 — semana em grade (colunas no desktop, um dia por vez no celular). */
export function AgendaPage() {
  const { user } = useAuth();
  const today = zonedNow(Date.now(), user?.timezone ?? "America/Sao_Paulo").date;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [selected, setSelected] = useState(today);
  const [dialog, setDialog] = useState<{ open: boolean; draft: BlockDraft }>({ open: false, draft: {} });
  const [copyOpen, setCopyOpen] = useState(false);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api.get<BlockDTO[]>("/blocks"),
  });

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const byDay = useMemo(() => new Map(days.map((d) => [d, blocksForDate(blocks, d)])), [days, blocks]);

  const openNew = (date: string) => setDialog({ open: true, draft: { date } });
  const openEdit = (b: BlockDTO, occurrenceDate: string) => setDialog({ open: true, draft: { ...b, occurrenceDate } });
  // RF03.3 — duplicar abre o formulário já preenchido, sem id
  const duplicate = (b: BlockDTO, date: string) =>
    setDialog({ open: true, draft: { ...b, id: undefined, recurrence: "ONCE", date, isOneThing: false } });

  const moveWeek = (delta: number) => {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelected(delta === 0 ? today : next);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl">Agenda da semana</h1>
          <p className="text-sm text-muted-foreground">
            {formatShortDate(days[0])} a {formatShortDate(days[6])}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border bg-card">
            <Button variant="ghost" size="icon" onClick={() => moveWeek(-1)} aria-label="Semana anterior">
              <ChevronLeft />
            </Button>
            <Button variant="ghost" onClick={() => { setWeekStart(startOfWeek(today)); setSelected(today); }}>
              Hoje
            </Button>
            <Button variant="ghost" size="icon" onClick={() => moveWeek(1)} aria-label="Próxima semana">
              <ChevronRight />
            </Button>
          </div>
          <Button variant="outline" onClick={() => setCopyOpen(true)}>
            <ClipboardCopy aria-hidden /> Copiar dia
          </Button>
          <Button onClick={() => openNew(selected < today ? today : selected)}>
            <Plus aria-hidden /> Novo bloco
          </Button>
        </div>
      </div>

      {/* Seletor de dia no celular */}
      <div className="grid grid-cols-7 gap-1 md:hidden" role="tablist" aria-label="Dia da semana">
        {days.map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={d === selected}
            onClick={() => setSelected(d)}
            className={cn(
              "flex flex-col items-center rounded-lg py-2 text-xs transition-colors duration-200",
              d === selected ? "bg-primary font-medium" : "bg-card",
              d === today && d !== selected && "ring-1 ring-primary-strong",
            )}
          >
            {WEEKDAY_LABELS[weekdayOf(d)]}
            <span className="text-base tabular-nums">{d.slice(8)}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando…</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-7">
          {days.map((d) => (
            <section
              key={d}
              aria-label={formatShortDate(d)}
              className={cn("flex flex-col gap-2 rounded-xl border bg-card/60 p-2", d !== selected && "hidden md:flex", d === today && "border-primary-strong/40 bg-primary/10")}
            >
              <header className="hidden items-baseline justify-between px-1 md:flex">
                <span className="text-sm font-medium">{WEEKDAY_LABELS[weekdayOf(d)]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{d.slice(8)}/{d.slice(5, 7)}</span>
              </header>
              {byDay.get(d)!.map((b) => (
                <article key={b.id} className="group rounded-lg p-2.5 text-sm text-on-block" style={{ background: b.color }}>
                  <button className="w-full text-left" onClick={() => openEdit(b, d)} aria-label={`Editar ${b.title}`}>
                    <div className="flex items-center gap-1 font-medium leading-tight">
                      {b.isOneThing && <Star className="size-3.5 shrink-0 fill-current" aria-label="A Única Coisa" />}
                      <span className="truncate">{b.title}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs opacity-75">
                      {b.startTime}–{b.endTime}
                      {b.recurrence === "REPEAT" && <Repeat className="size-3" aria-label="Recorrente" />}
                    </div>
                  </button>
                  <button
                    onClick={() => duplicate(b, d)}
                    className="mt-1 flex items-center gap-1 text-xs opacity-70 hover:opacity-100 md:opacity-0 md:group-hover:opacity-70 md:focus:opacity-100"
                  >
                    <Copy className="size-3" aria-hidden /> Duplicar
                  </button>
                </article>
              ))}
              {d >= today && (
                <button
                  onClick={() => openNew(d)}
                  className="rounded-lg border border-dashed py-2 text-xs text-muted-foreground transition-colors duration-200 hover:bg-muted"
                >
                  + bloco
                </button>
              )}
            </section>
          ))}
        </div>
      )}

      <BlockFormDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
        draft={dialog.draft}
        defaultDate={selected < today ? today : selected}
      />
      <CopyDayDialog open={copyOpen} onOpenChange={setCopyOpen} defaultFrom={selected} today={today} />
    </div>
  );
}

/** RF03.5 — copiar a agenda de um dia para outro. */
function CopyDayDialog({
  open,
  onOpenChange,
  defaultFrom,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFrom: string;
  today: string;
}) {
  const qc = useQueryClient();
  const [fromDate, setFrom] = useState(defaultFrom);
  const [toDate, setTo] = useState(addDays(defaultFrom < today ? today : defaultFrom, 1));
  const copy = useMutation({
    mutationFn: () => api.post<{ copied: number }>("/blocks/copy-day", { fromDate, toDate }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["blocks"] });
      qc.invalidateQueries({ queryKey: ["compass"] });
      toast.success(r.copied ? `${r.copied} bloco(s) copiado(s).` : "Não havia blocos nesse dia.");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar dia</DialogTitle>
        </DialogHeader>
        <p className="mb-4 text-sm text-muted-foreground">Os blocos são copiados como "Apenas neste dia" na data de destino.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De" htmlFor="copy-from">
            <Input id="copy-from" type="date" value={fromDate} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Para" htmlFor="copy-to">
            <Input id="copy-to" type="date" min={today} value={toDate} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={() => copy.mutate()} disabled={copy.isPending}>
            Copiar blocos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
