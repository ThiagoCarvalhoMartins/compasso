import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BatteryMedium } from "lucide-react";
import { Button, cn, Spinner, toast } from "@compasso/ui";
import { api } from "../lib/api";
import { GlassOverlay } from "./GlassOverlay";

const SCORES = Array.from({ length: 11 }, (_, i) => i);

/**
 * Registro de energia (0 a 10) na mesma camada de vidro da tela de boas-vindas. As respostas montam o
 * gráfico de energia por hora do Analytics. "Agora não" fecha sem registrar.
 */
export function EnergyCheckOverlay({ onClosed }: { onClosed: () => void }) {
  const qc = useQueryClient();
  const [score, setScore] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);

  const save = useMutation({
    mutationFn: (value: number) => api.post("/energy-checks", { score: value }),
    onSuccess: (_, value) => {
      toast.success(`Energia registrada: ${value} de 10.`);
      void qc.invalidateQueries({ queryKey: ["energy-summary"] });
      void qc.invalidateQueries({ queryKey: ["energy-last"] });
      setLeaving(true);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setLeaving(true);
    },
  });

  return (
    <GlassOverlay
      leaving={leaving}
      onClosed={onClosed}
      initialFocus={firstRef}
      labelledBy="energy-title"
      describedBy="energy-question"
    >
      <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-bottom-3 duration-700">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/40" aria-hidden>
          <BatteryMedium className="size-6" />
        </span>
        <div className="flex flex-col gap-3">
          <h1 id="energy-title" className="text-balance font-serif text-3xl md:text-4xl">
            Como está sua energia agora?
          </h1>
          <p id="energy-question" className="text-balance text-base text-muted-foreground md:text-lg">
            De 0 a 10, quanta disposição você tem agora para iniciar a leitura de um capítulo de um livro, fazer um
            estudo focado ou encarar atividades que considera chatas ou que costuma adiar?
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <div role="group" aria-label="Nota de 0 a 10" className="grid grid-cols-6 gap-2 sm:grid-cols-11">
            {SCORES.map((value) => {
              const checked = score === value;
              return (
                <button
                  key={value}
                  ref={value === 0 ? firstRef : undefined}
                  type="button"
                  aria-pressed={checked}
                  aria-label={`${value} de 10`}
                  onClick={() => setScore(value)}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-xl border bg-card/80 text-lg tabular-nums shadow-soft transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary-strong/60 active:scale-[0.96]",
                    checked && "border-primary-strong bg-primary text-primary-foreground",
                  )}
                >
                  {value}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
            <span>Nenhuma disposição</span>
            <span>Disposição total</span>
          </div>
        </div>

        <div className="flex flex-col-reverse items-center gap-2 sm:flex-row">
          <Button variant="ghost" disabled={save.isPending} onClick={() => setLeaving(true)}>
            Agora não
          </Button>
          <Button
            size="lg"
            className="rounded-full px-8 shadow-soft"
            disabled={score === null || save.isPending || leaving}
            onClick={() => score !== null && save.mutate(score)}
          >
            {save.isPending && <Spinner />} Registrar
          </Button>
        </div>
      </div>
    </GlassOverlay>
  );
}
