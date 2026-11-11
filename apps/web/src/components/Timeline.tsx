import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { timeToMinutes, type BlockDTO } from "@compasso/shared";
import { cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@compasso/ui";

const PX_PER_MIN = 1.1;
/** Altura mínima (px) para caber uma linha de título sem cortar. */
const MIN_TEXT_HEIGHT = 16;

/** RF04.1/RF04.2 — timeline vertical do dia, blocos proporcionais à duração e marcador do agora. */
export function Timeline({
  blocks,
  secondOfDay,
  currentId,
}: {
  blocks: BlockDTO[];
  secondOfDay: number;
  currentId: string | null;
}) {
  const nowMin = secondOfDay / 60;
  const starts = blocks.map((b) => timeToMinutes(b.startTime));
  const ends = blocks.map((b) => timeToMinutes(b.endTime));
  const first = Math.floor(Math.min(...starts, nowMin, 7 * 60) / 60) * 60;
  const last = Math.ceil(Math.max(...ends, nowMin + 1, 21 * 60) / 60) * 60;
  const y = (min: number) => (min - first) * PX_PER_MIN;
  const hours = Array.from({ length: (last - first) / 60 + 1 }, (_, i) => first + i * 60);

  const nowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="max-h-[70dvh] overflow-y-auto scrollbar-rounded rounded-xl border bg-card p-3"
        aria-label="Linha do tempo de hoje"
      >
        <div className="relative" style={{ height: y(last) + 8 }}>
          {hours.map((h) => (
            // A linha da hora precisa ficar exatamente em y(h): centraliza a linha inteira (rótulo + traço) nesse ponto.
            <div key={h} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: y(h) }}>
              <span className="w-11 text-right text-xs text-muted-foreground">
                {String(h / 60).padStart(2, "0")}:00
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}

          <ol className="absolute inset-y-0 left-14 right-0">
            {blocks.map((b) => {
              // O bloco nunca sai da faixa [início, fim]: 1px de folga em cada borda, sem altura mínima que invada o vizinho.
              const start = y(timeToMinutes(b.startTime));
              const top = start + 1;
              const height = Math.max(y(timeToMinutes(b.endTime)) - start - 2, 1);
              const compact = height < 28;
              // Abaixo de uma linha de texto (~16px) o título seria cortado: oculta o conteúdo e mostra os dados no tooltip.
              const hideText = height < MIN_TEXT_HEIGHT;
              const isCurrent = b.id === currentId;
              const item = (
                <li
                  key={b.id}
                  className={cn(
                    "absolute inset-x-0 overflow-hidden px-3 text-on-block transition-shadow duration-300",
                    compact ? "flex items-center rounded-md py-0 text-xs" : "rounded-lg py-1.5 text-sm",
                    hideText &&
                      "cursor-default outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isCurrent && "ring-2 ring-inset ring-primary-strong",
                  )}
                  style={{ top, height, background: b.color }}
                  aria-current={isCurrent ? "time" : undefined}
                  aria-label={hideText ? `${b.title}, ${b.startTime}–${b.endTime}` : undefined}
                  tabIndex={hideText ? 0 : undefined}
                >
                  {!hideText && (
                    <>
                      <div className="flex items-center gap-1 font-medium leading-tight">
                        {b.isOneThing && <Star className="size-3.5 fill-current" aria-label="A Única Coisa" />}
                        <span className="truncate">{b.title}</span>
                      </div>
                      {height > 34 && (
                        <div className="text-xs opacity-75">
                          {b.startTime}–{b.endTime}
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
              if (!hideText) return item;
              return (
                <Tooltip key={b.id}>
                  <TooltipTrigger asChild>{item}</TooltipTrigger>
                  <TooltipContent side="right" align="start">
                    <div className="flex items-center gap-1 font-medium">
                      {b.isOneThing && (
                        <Star className="size-3.5 fill-current text-primary-strong" aria-label="A Única Coisa" />
                      )}
                      <span>{b.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.startTime}–{b.endTime}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </ol>

          <div
            ref={nowRef}
            className="pointer-events-none absolute left-12 right-0 z-10 flex -translate-y-1/2 items-center transition-[top] duration-1000 ease-linear"
            style={{ top: y(nowMin) }}
            aria-label="Agora"
          >
            <span className="size-3 -translate-x-1/2 rounded-full bg-primary-strong" />
            <span className="h-0.5 flex-1 bg-primary-strong" />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
