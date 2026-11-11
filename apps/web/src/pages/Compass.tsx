import { useEffect, useMemo, useState } from "react";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BellOff, BellRing, Lightbulb, LightbulbOff, Play, Star } from "lucide-react";
import {
  compassState,
  formatCountdown,
  timeToMinutes,
  type BlockLogStatus,
  type CompassTodayDTO,
} from "@compasso/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn, Progress, Spinner, toast } from "@compasso/ui";
import { QpLauncher } from "../components/Qp";
import { Timeline } from "../components/Timeline";
import { useAlerts } from "../hooks/useAlerts";
import { useNow } from "../hooks/useNow";
import { useWakeLock } from "../hooks/useWakeLock";
import { api } from "../lib/api";
import { isAudioUnlocked, unlockAudio } from "../lib/audio";
import { formatLongDate, humanDuration, zonedNow } from "../lib/time";

const MUTE_MINUTES = 30;
const STATUS_LABEL: Record<BlockLogStatus, string> = { DONE: "Concluído", PARTIAL: "Parcial", SKIPPED: "Não realizado" };
const STATUS_CHIP: Record<BlockLogStatus, string> = {
  DONE: "bg-status-done text-status-done-foreground",
  PARTIAL: "bg-status-partial text-status-partial-foreground",
  SKIPPED: "bg-status-skipped text-status-skipped-foreground",
};
const MARK_BLOCK_KEY = ["mark-block"];

type MarkBlockVariables = { blockId: string; status: BlockLogStatus };

export function CompassPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["compass"],
    queryFn: () => api.get<CompassTodayDTO>("/compass/today"),
  });
  const now = useNow();
  const [started, setStarted] = useState(isAudioUnlocked);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const wake = useWakeLock();

  const tz = data?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = zonedNow(now, tz);

  // Virada do dia: troca a timeline e zera o contador QP sem refresh.
  useEffect(() => {
    if (data && local.date !== data.date) void qc.invalidateQueries({ queryKey: ["compass"] });
  }, [data, local.date, qc]);

  useEffect(() => {
    if (mutedUntil && now >= mutedUntil) setMutedUntil(null);
  }, [mutedUntil, now]);

  const blocks = useMemo(() => data?.blocks ?? [], [data]);
  useAlerts({
    date: data?.date ?? local.date,
    timezone: tz,
    blocks,
    settings: data?.settings ?? { alertsEnabled: false, alertSound: "sino", alertVolume: 0.7, endAlertMinutes: 5, qpDurationSeconds: null },
    started,
    mutedUntil,
  });

  const mark = useMutation({
    mutationKey: MARK_BLOCK_KEY,
    mutationFn: ({ blockId, status }: MarkBlockVariables) => api.put(`/blocks/${blockId}/logs/${data!.date}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compass"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  // Por bloco, e não mark.isPending: confirmar um bloco não pode travar nem apagar o spinner dos demais.
  const pendingMarks = useMutationState({
    filters: { mutationKey: MARK_BLOCK_KEY, status: "pending" },
    select: (mutation) => mutation.state.variables as MarkBlockVariables,
  });

  if (isLoading) return <p className="text-muted-foreground">Carregando seu dia…</p>;
  if (error || !data) return <p role="alert">Não foi possível carregar o dia. Tente recarregar a página.</p>;

  const state = compassState(blocks, local.secondOfDay);
  const endWarning =
    state.current && state.secondsToCurrentEnd !== null && state.secondsToCurrentEnd <= data.settings.endAlertMinutes * 60;
  const pendingReview = blocks.filter((b) => timeToMinutes(b.endTime) * 60 <= local.secondOfDay && !b.log);
  const muted = mutedUntil !== null;

  const startDay = async () => {
    unlockAudio();
    setStarted(true);
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => undefined);
    }
    toast.success("Alertas ativados para hoje.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-sm capitalize text-muted-foreground mb-1.5">{formatLongDate(data.date)}</p>
          <h1 className="text-3xl md:text-4xl">Seu dia em ritmo</h1>
        </div>

        {!started && (
          <Card className="border-primary bg-primary/20">
            <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                Toque em <strong>Iniciar meu dia</strong> para liberar os alertas sonoros de hoje.
              </p>
              <Button size="lg" onClick={startDay}>
                <Play aria-hidden /> Iniciar meu dia
              </Button>
            </CardContent>
          </Card>
        )}

        {/* RF04.3 / RF04.5 */}
        <Card className={endWarning ? "border-accent bg-accent/30" : undefined} aria-live="polite">
          <CardHeader>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {state.current ? "Agora" : "Tempo livre"}
            </p>
            {state.current ? (
              <>
                <CardTitle className="flex items-center gap-2 text-3xl md:text-4xl">
                  {state.current.isOneThing && <Star className="size-6 fill-accent" aria-label="A Única Coisa" />}
                  {state.current.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {state.current.startTime}–{state.current.endTime} ·{" "}
                  {humanDuration(timeToMinutes(state.current.endTime) - timeToMinutes(state.current.startTime))}
                </p>
              </>
            ) : (
              <CardTitle className="text-3xl">
                {blocks.length ? "Nenhum bloco neste horário" : "Nenhum bloco para hoje"}
              </CardTitle>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {state.current && (
              <>
                <Progress value={state.currentProgress} label="Progresso do bloco atual" />
                <p className="text-lg">
                  Faltam <span className="font-semibold tabular-nums">{formatCountdown(state.secondsToCurrentEnd!)}</span>
                  {endWarning && <Badge className="ml-2 bg-accent">Reta final</Badge>}
                </p>
              </>
            )}
            {!blocks.length && (
              <Button asChild variant="outline" className="self-start">
                <Link to="/agenda">Montar minha agenda</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* RF04.4 */}
        {state.next && (
          <Card>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="size-3 rounded-full" style={{ background: state.next.color }} aria-hidden />
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">A seguir</p>
                  <p className="font-medium">{state.next.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {state.next.startTime}–{state.next.endTime}
                  </p>
                </div>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                começa em
                <br />
                <span className="text-lg font-semibold tabular-nums text-foreground">{formatCountdown(state.secondsToNext!)}</span>
              </p>
            </CardContent>
          </Card>
        )}

        {/* RF04.6 */}
        {blocks.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>Progresso do dia</span>
              <span className="tabular-nums text-muted-foreground">{Math.round(state.dayProgress * 100)}%</span>
            </div>
            <Progress value={state.dayProgress} label="Progresso do dia" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {/* RF04.10 */}
          <Button
            variant="outline"
            onClick={() => setMutedUntil(muted ? null : Date.now() + MUTE_MINUTES * 60_000)}
            aria-pressed={muted}
          >
            {muted ? <BellOff aria-hidden /> : <BellRing aria-hidden />}
            {muted
              ? `Silenciado até ${new Date(mutedUntil!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : `Silenciar ${MUTE_MINUTES} min`}
          </Button>
          {wake.supported && (
            <Button variant="outline" onClick={wake.toggle} aria-pressed={wake.active}>
              {wake.active ? <Lightbulb aria-hidden /> : <LightbulbOff aria-hidden />}
              {wake.active ? "Tela sempre ligada" : "Manter tela ligada"}
            </Button>
          )}
        </div>

        {/* RF04.11 */}
        {pendingReview.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Como foram seus blocos?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {pendingReview.map((b) => {
                const pendingStatus = pendingMarks.find((m) => m.blockId === b.id)?.status;
                return (
                  <div key={b.id} className="flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm">
                      <strong className="font-medium">{b.title}</strong>{" "}
                      <span className="text-muted-foreground">
                        {b.startTime}–{b.endTime}
                      </span>
                    </span>
                    <div className="flex gap-1.5">
                      {(["DONE", "PARTIAL", "SKIPPED"] as const).map((s) => {
                        const loading = pendingStatus === s;
                        return (
                          <Button
                            key={s}
                            size="sm"
                            variant={s === "DONE" ? "default" : "outline"}
                            className={cn("relative", loading && "disabled:opacity-100")}
                            disabled={pendingStatus !== undefined}
                            aria-busy={loading}
                            onClick={() => mark.mutate({ blockId: b.id, status: s })}
                          >
                            {/* O rótulo fica transparente para o botão manter a largura e o nome acessível. */}
                            <span className={loading ? "opacity-0" : undefined}>{STATUS_LABEL[s]}</span>
                            {loading && <Spinner className="absolute inset-0 m-auto" />}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <QpLauncher settings={data.settings} qpToday={data.qpToday} />
      </div>

      <aside className="flex flex-col gap-3">
        <h2 className="text-xl">Hoje</h2>
        <Timeline blocks={blocks} secondOfDay={local.secondOfDay} currentId={state.current?.id ?? null} />
        {blocks.some((b) => b.log) && (
          <ul className="flex flex-wrap gap-1.5 text-xs">
            {blocks
              .filter((b) => b.log)
              .map((b) => (
                <li key={b.id}>
                  <Badge className={STATUS_CHIP[b.log!]}>
                    {b.title}: {STATUS_LABEL[b.log!]}
                  </Badge>
                </li>
              ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
