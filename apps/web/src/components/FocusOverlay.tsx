import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, NotebookPen, Star } from "lucide-react";
import { timeToMinutes, type DailyFocusDTO, type DailyFocusInput, type FocusSlot } from "@compasso/shared";
import { Button, cn, Input, Spinner, toast } from "@compasso/ui";
import { api } from "../lib/api";
import type { CompassBlock } from "../lib/streak";
import { GlassOverlay } from "./GlassOverlay";

const hourLabel = (time: string) => {
  const [h, m] = time.split(":");
  return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`;
};
const decimal = (value: number) =>
  value.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

/** Depois de fechar: nada a fazer, ou abrir o formulário de bloco já preenchido com o horário sugerido. */
export type FocusClose = {
  createBlock: { title: string; slot: FocusSlot } | null;
};

/**
 * Pergunta focal de A Única Coisa, no mesmo vidro fosco da tela de boas-vindas, em dois passos:
 * a pergunta e, depois, onde ela entra no dia (um bloco de hoje, um bloco novo no pico de energia ou só registrar).
 */
export function FocusOverlay({
  date,
  blocks,
  nowMinute,
  planned,
  current,
  slot,
  editing,
  onClosed,
}: {
  date: string;
  /** Blocos de hoje. */
  blocks: CompassBlock[];
  nowMinute: number;
  /** Bloco com estrela de hoje, sugerido como resposta. */
  planned: CompassBlock | null;
  /** Resposta já gravada (ao alterar pelo card). */
  current: DailyFocusDTO | null;
  /** Horário sugerido para um bloco novo; nulo se nada cabe hoje. */
  slot: FocusSlot | null;
  /** Aberta pelo card: "Agora não" vira "Cancelar" e não grava nada. */
  editing: boolean;
  onClosed: (result: FocusClose) => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"ask" | "place">("ask");
  const [answer, setAnswer] = useState(current?.answer ?? "");
  const [leaving, setLeaving] = useState(false);
  const result = useRef<FocusClose>({ createBlock: null });
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const save = useMutation({
    mutationFn: (input: DailyFocusInput) => api.put<DailyFocusDTO>(`/focus/${date}`, input),
    onSuccess: (focus) => {
      void qc.invalidateQueries({ queryKey: ["compass"] });
      void qc.invalidateQueries({ queryKey: ["focus-summary"] });
      if (!focus.skipped && !result.current.createBlock) toast.success("Sua Única Coisa de hoje está definida.");
      setLeaving(true);
    },
    onError: (e: Error) => {
      result.current = { createBlock: null };
      toast.error(e.message);
    },
  });

  const close = (next: FocusClose = { createBlock: null }) => {
    result.current = next;
    setLeaving(true);
  };

  const text = answer.trim();
  // Blocos que ainda não terminaram: dá para fazer a Única Coisa neles hoje.
  const upcoming = blocks.filter((b) => timeToMinutes(b.endTime) > nowMinute);

  return (
    <GlassOverlay
      leaving={leaving}
      onClosed={() => onClosed(result.current)}
      initialFocus={planned && !editing ? confirmRef : inputRef}
      labelledBy="focus-title"
      describedBy="focus-question"
    >
      {step === "ask" ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/70" aria-hidden>
            <Star className="size-6 fill-current" />
          </span>
          <div className="flex flex-col gap-3">
            <h1 id="focus-title" className="text-balance font-serif text-3xl md:text-4xl">
              Qual é a sua Única Coisa hoje?
            </h1>
            <p id="focus-question" className="text-balance text-base text-muted-foreground md:text-lg">
              Qual é a ÚNICA coisa que, se você fizer hoje, torna todo o resto mais fácil ou desnecessário?
            </p>
          </div>

          {planned && !editing && (
            <div className="flex w-full flex-col items-center gap-3 rounded-2xl border bg-card/80 p-4 shadow-soft">
              <p className="text-sm text-muted-foreground">Sua Única Coisa planejada para hoje é</p>
              <p className="font-serif text-2xl">
                {planned.title}{" "}
                <span className="text-base text-muted-foreground tabular-nums">
                  {planned.startTime}–{planned.endTime}
                </span>
              </p>
              <Button
                ref={confirmRef}
                className="rounded-full px-6"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    answer: planned.title,
                    blockId: planned.id,
                    skipped: false,
                  })
                }
              >
                {save.isPending && <Spinner />} Continua sendo esta
              </Button>
            </div>
          )}

          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (text) setStep("place");
            }}
          >
            <label htmlFor="focus-answer" className="sr-only">
              Sua Única Coisa
            </label>
            <Input
              id="focus-answer"
              ref={inputRef}
              value={answer}
              maxLength={200}
              autoComplete="off"
              placeholder={planned && !editing ? "Ou escreva outra…" : "Ex.: terminar o capítulo 3 do TCC"}
              onChange={(e) => setAnswer(e.target.value)}
              className="h-12 rounded-xl bg-card/80 text-center text-base"
            />
            <div className="flex flex-col-reverse items-center justify-center gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => (editing ? close() : save.mutate({ skipped: true }))}
              >
                {editing ? "Cancelar" : "Agora não"}
              </Button>
              <Button type="submit" size="lg" className="rounded-full px-8 shadow-soft" disabled={!text}>
                Continuar
              </Button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-right-3 duration-500">
          <div className="flex flex-col gap-3">
            <h1 id="focus-title" className="text-balance font-serif text-3xl md:text-4xl">
              Onde ela entra no seu dia?
            </h1>
            <p id="focus-question" className="text-balance text-base text-muted-foreground md:text-lg">
              “{text}”
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 text-left">
            {slot && (
              <PlaceOption
                icon={<CalendarPlus className="size-5" />}
                title={`Criar um bloco das ${hourLabel(slot.startTime)} às ${hourLabel(slot.endTime)}`}
                description={
                  slot.average !== null
                    ? `Seu pico de energia livre hoje (média ${decimal(slot.average)} de 10).`
                    : "Próximo horário livre. Com mais registros de energia, sugiro o seu pico."
                }
                highlight
                disabled={save.isPending}
                onClick={() => {
                  result.current = { createBlock: { title: text, slot } };
                  save.mutate({ answer: text, blockId: null, skipped: false });
                }}
              />
            )}
            {upcoming.length > 0 && (
              <fieldset className="flex flex-col gap-2 rounded-xl border bg-card/80 p-3">
                <legend className="px-1 text-xs font-medium text-muted-foreground">Ou use um bloco de hoje</legend>
                <div className="flex flex-wrap gap-2">
                  {upcoming.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      disabled={save.isPending}
                      onClick={() =>
                        save.mutate({
                          answer: text,
                          blockId: b.id,
                          skipped: false,
                        })
                      }
                      className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-sm transition-colors hover:border-primary-strong/60 hover:bg-muted"
                    >
                      <span className="size-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
                      {b.title}
                      <span className="tabular-nums text-muted-foreground">
                        {b.startTime}–{b.endTime}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <PlaceOption
              icon={<NotebookPen className="size-5" />}
              title="Só registrar, sem horário"
              description="Fica no topo da tela Compasso para você lembrar ao longo do dia."
              disabled={save.isPending}
              onClick={() => save.mutate({ answer: text, blockId: null, skipped: false })}
            />
          </div>

          <Button variant="ghost" disabled={save.isPending} onClick={() => setStep("ask")}>
            <ArrowLeft aria-hidden /> Voltar
          </Button>
        </div>
      )}
    </GlassOverlay>
  );
}

function PlaceOption({
  icon,
  title,
  description,
  highlight,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left shadow-soft transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary-strong/60 disabled:opacity-60",
        highlight ? "border-primary-strong/40 bg-primary/30" : "bg-card/80",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
