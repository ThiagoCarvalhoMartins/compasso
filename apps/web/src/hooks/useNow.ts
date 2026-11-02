import { useEffect, useState } from "react";

/**
 * Relógio da tela. Nunca soma ticks: cada atualização relê `Date.now()`,
 * então atrasos de timers em abas inativas não acumulam erro.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: number;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      // Alinha ao próximo segundo cheio.
      timer = window.setTimeout(tick, intervalMs - (t % intervalMs) + 5);
    };
    tick();
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
  return now;
}
