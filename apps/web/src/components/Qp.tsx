import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, Settings2, Sparkles } from "lucide-react";
import { QP_DEFAULT_DURATION, QP_DURATIONS, type QpDuration, type SettingsDTO } from "@compasso/shared";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Label,
  Progress,
  Select,
  toast,
} from "@compasso/ui";
import { api } from "../lib/api";
import { playAlert, unlockAudio } from "../lib/audio";
import { useNow } from "../hooks/useNow";

const FOCUS = [
  { title: "Respiração", text: "Sinta o ar entrando e saindo. Note a temperatura e o ritmo, sem mudar nada." },
  { title: "Toque", text: "Esfregue as pontas dos dedos devagar. Perceba cada ranhura e a textura da pele." },
  { title: "Audição", text: "Escute o som mais distante que conseguir. Depois, o mais próximo." },
];

/**
 * RF05.1–RF05.3: na primeira vez pede a duração (dropdown com 15 s); depois, Iniciar começa na hora.
 * "Ajustar duração" reabre o dropdown.
 */
export function QpLauncher({ settings, qpToday }: { settings: SettingsDTO; qpToday?: number }) {
  const saved = settings.qpDurationSeconds;
  const [adjusting, setAdjusting] = useState(saved === null);
  const [duration, setDuration] = useState<QpDuration>(saved ?? QP_DEFAULT_DURATION);
  const [session, setSession] = useState<{ id: string; startedAt: number; planned: number } | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (saved !== null) setDuration(saved);
  }, [saved]);

  const start = useMutation({
    mutationFn: (plannedSeconds: number) => api.post<{ id: string; plannedSeconds: number }>("/qp-sessions", { plannedSeconds }),
    onSuccess: (s) => {
      setSession({ id: s.id, startedAt: Date.now(), planned: s.plannedSeconds });
      setAdjusting(false);
      qc.invalidateQueries({ queryKey: ["compass"] });
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const begin = () => {
    unlockAudio();
    start.mutate(duration);
  };

  return (
    <Card className="relative bg-secondary/35">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3"
        onClick={() => setInfoOpen(true)}
        aria-label="Curiosidade: por que fazer Repetições QP"
        title="Curiosidade"
      >
        <CircleHelp aria-hidden />
      </Button>
      <QpInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 pr-10">
          <Sparkles className="size-5" aria-hidden /> Repetições QP
        </CardTitle>
        <CardDescription>
          Alguns segundos de atenção plena para fortalecer o Sábio.
          {qpToday !== undefined && (
            <>
              {" "}
              <strong className="text-foreground">{qpToday}</strong> {qpToday === 1 ? "repetição" : "repetições"} hoje.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        {adjusting && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qp-duration">Duração</Label>
            <Select
              id="qp-duration"
              className="w-36"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) as QpDuration)}
            >
              {QP_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} segundos
                </option>
              ))}
            </Select>
          </div>
        )}
        <Button size="lg" variant="secondary" className="bg-secondary" onClick={begin} disabled={start.isPending}>
          Iniciar{!adjusting && ` · ${duration} s`}
        </Button>
        {!adjusting && (
          <Button variant="ghost" onClick={() => setAdjusting(true)}>
            <Settings2 aria-hidden /> Ajustar duração
          </Button>
        )}
      </CardContent>
      {session && (
        <QpSession
          session={session}
          volume={settings.alertVolume}
          onClose={() => {
            setSession(null);
            qc.invalidateQueries({ queryKey: ["compass"] });
            qc.invalidateQueries({ queryKey: ["qp-summary"] });
          }}
        />
      )}
    </Card>
  );
}

/** Por que as repetições importam, com base no livro que inspirou o exercício. */
function QpInfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Por que fazer Repetições QP?</DialogTitle>
          <DialogDescription>
            Com base em <em>Inteligência Positiva</em>, de Shirzad Chamine.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            Para Chamine, o QP (Quociente de Positividade) indica, de 0 a 100, com que frequência sua mente trabalha a seu
            favor em vez de sabotar você. Ele aponta 75 como o ponto de virada.
          </p>
          <p>
            Uma Repetição QP é simples: levar a atenção ao corpo ou a um dos sentidos por pelo menos 10 segundos, cerca de três
            respirações. Esse instante ajuda a silenciar os Sabotadores, como o Crítico, e dá espaço ao Sábio, a parte da mente
            que responde com mais calma e clareza.
          </p>
          <p>
            O autor compara a prática a um treino de musculação: o que fortalece a mente é a repetição, não a duração. Por isso,
            ele sugere cerca de 100 repetições por dia, encaixadas na rotina, durante pelo menos 21 dias.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** RF05.4/RF05.5 — sessão em tela cheia com cronômetro, foco sensorial e som suave no início e no fim. */
function QpSession({
  session,
  volume,
  onClose,
}: {
  session: { id: string; startedAt: number; planned: number };
  volume: number;
  onClose: () => void;
}) {
  const now = useNow(250);
  const elapsed = Math.min(session.planned, (now - session.startedAt) / 1000);
  const remaining = Math.max(0, Math.ceil(session.planned - elapsed));
  const focus = FOCUS[Math.floor(elapsed / 10) % FOCUS.length];
  const ended = useRef(false);
  const finishRef = useRef<HTMLButtonElement>(null);

  const finish = async (completed: boolean) => {
    if (ended.current) return;
    ended.current = true;
    const actualSeconds = completed ? session.planned : Math.floor((Date.now() - session.startedAt) / 1000);
    playAlert("qp", "tigela", volume);
    try {
      const r = await api.patch<{ completed: boolean }>(`/qp-sessions/${session.id}`, { actualSeconds });
      // RN11: encerrada antes do fim não soma ao contador.
      if (r.completed) toast.success("Repetição concluída. Bom trabalho.");
      else toast("Sessão encerrada antes do fim — registrada como incompleta.");
    } catch (e) {
      toast.error((e as Error).message);
    }
    onClose();
  };

  useEffect(() => {
    playAlert("qp", "tigela", volume);
    finishRef.current?.focus();
  }, [volume]);

  useEffect(() => {
    if (remaining === 0) void finish(true);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qp-title"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#f4f1fa] p-6 text-center"
    >
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Repetição QP</p>
      <div className="font-serif text-8xl tabular-nums" aria-live="off">
        {remaining}
      </div>
      <div className="max-w-sm" aria-live="polite">
        <h2 id="qp-title" className="text-2xl">
          {focus.title}
        </h2>
        <p className="mt-2 text-muted-foreground">{focus.text}</p>
      </div>
      <Progress value={elapsed / session.planned} label="Progresso da repetição" className="max-w-xs" indicatorClassName="bg-secondary" />
      <Button ref={finishRef} variant="outline" onClick={() => finish(false)}>
        Encerrar agora
      </Button>
    </div>
  );
}
