import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import { timeToMinutes, type BlockDTO } from "@compasso/shared";
import { cn } from "@compasso/ui";

const PX_PER_MIN = 1.1;

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
    <div className="max-h-[70dvh] overflow-y-auto scrollbar-rounded rounded-xl border bg-card p-3" aria-label="Linha do tempo de hoje">
      <div className="relative" style={{ height: y(last) + 8 }}>
        {hours.map((h) => (
          <div key={h} className="absolute inset-x-0 flex items-center gap-2" style={{ top: y(h) }}>
            <span className="w-11 -translate-y-1/2 text-right text-xs text-muted-foreground">
              {String(h / 60).padStart(2, "0")}:00
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}

        <ol className="absolute inset-y-0 left-14 right-0">
          {blocks.map((b) => {
            const top = y(timeToMinutes(b.startTime));
            const height = Math.max(y(timeToMinutes(b.endTime)) - top - 2, 18);
            const isCurrent = b.id === currentId;
            return (
              <li
                key={b.id}
                className={cn(
                  "absolute inset-x-0 overflow-hidden rounded-lg px-3 py-1.5 text-sm text-on-block transition-shadow duration-300",
                  isCurrent && "ring-2 ring-primary-strong",
                )}
                style={{ top, height, background: b.color }}
                aria-current={isCurrent ? "time" : undefined}
              >
                <div className="flex items-center gap-1 font-medium leading-tight">
                  {b.isOneThing && <Star className="size-3.5 fill-current" aria-label="A Única Coisa" />}
                  <span className="truncate">{b.title}</span>
                </div>
                {height > 34 && (
                  <div className="text-xs opacity-75">
                    {b.startTime}–{b.endTime}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div
          ref={nowRef}
          className="pointer-events-none absolute left-12 right-0 z-10 flex items-center transition-[top] duration-1000 ease-linear"
          style={{ top: y(nowMin) }}
          aria-label="Agora"
        >
          <span className="size-3 -translate-x-1/2 rounded-full bg-primary-strong" />
          <span className="h-0.5 flex-1 bg-primary-strong" />
        </div>
      </div>
    </div>
  );
}
