import { useCallback, useEffect, useRef, useState } from "react";

/** Screen Wake Lock (opcional): mantém a tela ligada no celular enquanto a tela Compasso está aberta. */
export function useWakeLock() {
  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
  const [active, setActive] = useState(false);
  const sentinel = useRef<WakeLockSentinel | null>(null);
  const wanted = useRef(false);

  const acquire = useCallback(async () => {
    if (!supported) return;
    try {
      sentinel.current = await navigator.wakeLock.request("screen");
      setActive(true);
      sentinel.current.addEventListener("release", () => setActive(false));
    } catch {
      setActive(false);
    }
  }, [supported]);

  const toggle = useCallback(async () => {
    wanted.current = !wanted.current;
    if (wanted.current) await acquire();
    else await sentinel.current?.release();
  }, [acquire]);

  // O navegador solta o wake lock ao trocar de aba; pede de novo ao voltar.
  useEffect(() => {
    const onVisible = () => wanted.current && document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel.current?.release();
    };
  }, [acquire]);

  return { supported, active, toggle };
}
