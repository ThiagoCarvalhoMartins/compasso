import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
} from "@compasso/ui";
import { formatCountdown, type BlockLogStatus } from "@compasso/shared";
import { useNow } from "../hooks/useNow";
import { playAlert } from "../lib/audio";
import type { CompassBlock } from "../lib/streak";

const MINIMUM_SECONDS = 120;

/**
 * Antes de marcar "Não realizado" um bloco com versão de 2 minutos, oferece fazer só o mínimo (Hábitos Atômicos):
 * - "Fiz a versão mínima" e o fim do cronômetro gravam Parcial pela versão mínima;
 * - "Hoje não deu" grava Não realizado, como antes.
 */
export function MinimumVersionDialog({
  block,
  volume,
  onMark,
  onCancel,
}: {
  block: CompassBlock;
  volume: number;
  onMark: (status: BlockLogStatus, viaMinimum: boolean) => void;
  onCancel: () => void;
}) {
  const [timerStart, setTimerStart] = useState<number | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        {timerStart === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Que tal só a versão de 2 minutos?</DialogTitle>
              <DialogDescription>
                Em vez de deixar “{block.title}” em branco, faça o mínimo. Começar é o que mantém o hábito vivo.
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-lg bg-accent/40 p-3 text-center font-serif text-xl">{block.minimumVersion}</p>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => onMark("SKIPPED", false)}>
                Hoje não deu
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => onMark("PARTIAL", true)}>
                  Fiz a versão mínima
                </Button>
                <Button onClick={() => setTimerStart(Date.now())}>
                  <Timer aria-hidden /> Fazer agora
                </Button>
              </div>
            </DialogFooter>
          </>
        ) : (
          <MinimumTimer
            block={block}
            startedAt={timerStart}
            volume={volume}
            onDone={() => onMark("PARTIAL", true)}
            onBack={() => setTimerStart(null)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MinimumTimer({
  block,
  startedAt,
  volume,
  onDone,
  onBack,
}: {
  block: CompassBlock;
  startedAt: number;
  volume: number;
  onDone: () => void;
  onBack: () => void;
}) {
  const now = useNow(250);
  const elapsed = Math.min(MINIMUM_SECONDS, (now - startedAt) / 1000);
  const remaining = Math.max(0, Math.ceil(MINIMUM_SECONDS - elapsed));
  const finished = remaining === 0;
  const chimed = useRef(false);

  useEffect(() => {
    if (!finished || chimed.current) return;
    chimed.current = true;
    playAlert("qp", "tigela", volume);
  }, [finished, volume]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{finished ? "Pronto! Você não desistiu." : block.minimumVersion}</DialogTitle>
        <DialogDescription>
          {finished
            ? "A versão mínima conta: o bloco fica como Parcial. Se quiser, continue além dela."
            : "Só 2 minutos. Se der vontade de continuar, ótimo; se não, já valeu."}
        </DialogDescription>
      </DialogHeader>
      <p className="text-center font-serif text-5xl tabular-nums" aria-live="off">
        {formatCountdown(remaining)}
      </p>
      <Progress value={elapsed / MINIMUM_SECONDS} label="Tempo da versão de 2 minutos" />
      <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {!finished && (
          <Button variant="ghost" onClick={onBack}>
            Voltar
          </Button>
        )}
        <Button onClick={onDone} className={finished ? "w-full sm:w-auto sm:ml-auto" : undefined}>
          {finished ? "Registrar como Parcial" : "Já fiz"}
        </Button>
      </DialogFooter>
    </>
  );
}
