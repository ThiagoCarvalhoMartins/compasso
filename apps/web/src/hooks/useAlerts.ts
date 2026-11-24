import { useEffect, useRef } from "react";
import { minutesToTime, planAlerts, type SettingsDTO } from "@compasso/shared";
import { toast } from "@compasso/ui";
import { playAlert } from "../lib/audio";
import { missReminder, type CompassBlock } from "../lib/streak";
import { localTimeToEpoch } from "../lib/time";

/** Alertas que passaram há até este tempo (ex.: aba voltou do segundo plano) ainda tocam, atrasados. */
const LATE_TOLERANCE_MS = 60_000;

interface Options {
  date: string;
  timezone: string;
  blocks: CompassBlock[];
  settings: SettingsDTO;
  /** Usuário iniciou o dia e não pausou as notificações. */
  started: boolean;
  /** Silenciado temporariamente até este instante (RF04.10). */
  mutedUntil: number | null;
  /** Título de cada micro-hábito, por id: o alerta de fim lembra do que vem depois do bloco. */
  habits: Map<string, string>;
}

/**
 * RF04.7–RF04.9: agenda cada alerta pelo horário exato do evento (setTimeout por evento, não polling)
 * e reagenda ao voltar para a aba (visibilitychange). Som + toast + notificação do navegador.
 */
export function useAlerts({ date, timezone, blocks, settings, started, mutedUntil, habits }: Options) {
  const fired = useRef(new Set<string>());
  const latest = useRef({ settings, mutedUntil });
  latest.current = { settings, mutedUntil };
  const latestHabits = useRef(habits);
  latestHabits.current = habits;

  useEffect(() => {
    if (!started || !settings.alertsEnabled) return;
    const timers: number[] = [];
    const alerts = planAlerts(blocks, settings.endAlertMinutes).map((a) => ({
      ...a,
      key: `${date}:${a.block.id}:${a.kind}:${a.block.startTime}-${a.block.endTime}`,
      at: localTimeToEpoch(date, minutesToTime(a.minute), timezone),
    }));

    const fire = (alert: (typeof alerts)[number]) => {
      if (fired.current.has(alert.key)) return;
      fired.current.add(alert.key);
      const { settings: s, mutedUntil: muted } = latest.current;
      const silent = muted !== null && Date.now() < muted;
      if (!silent) playAlert(alert.kind, s.alertSound, s.alertVolume);

      const title =
        alert.kind === "start"
          ? `Começou: ${alert.block.title}`
          : `Faltam ${s.endAlertMinutes} min para o fim de ${alert.block.title}`;
      const time = `${alert.block.startTime}–${alert.block.endTime}`;
      // Nunca falhe duas vezes: o alerta de início lembra que a última ocorrência não deu.
      const reminder = alert.kind === "start" ? missReminder(alert.block) : null;
      // Empilhamento de hábitos: o fim do bloco lembra do micro-hábito que vem em seguida.
      const habit = alert.kind === "end" && alert.block.microHabitId ? latestHabits.current.get(alert.block.microHabitId) : null;
      const body = reminder ? `${time} · ${reminder.message}` : habit ? `${time} · Ao terminar: ${habit}` : time;
      // RNF10: todo alerta sonoro tem equivalente visual.
      toast(title, { description: body, duration: 10_000 });
      if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker?.ready
          .then((reg) => reg.showNotification(title, { body, icon: "/icon.svg", tag: alert.key, silent }))
          .catch(() => new Notification(title, { body, icon: "/icon.svg", tag: alert.key }));
      }
    };

    const schedule = () => {
      timers.splice(0).forEach(clearTimeout);
      const now = Date.now();
      for (const alert of alerts) {
        if (fired.current.has(alert.key)) continue;
        const delay = alert.at - now;
        if (delay <= 0) {
          if (-delay <= LATE_TOLERANCE_MS) fire(alert);
          else fired.current.add(alert.key); // passou faz tempo: não toca atrasado
        } else if (delay < 24 * 3600_000) {
          timers.push(window.setTimeout(() => fire(alert), delay));
        }
      }
    };

    schedule();
    const onVisible = () => document.visibilityState === "visible" && schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [date, timezone, blocks, settings.alertsEnabled, settings.endAlertMinutes, started]);
}
