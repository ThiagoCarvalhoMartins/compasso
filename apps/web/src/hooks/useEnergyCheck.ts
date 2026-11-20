import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const MINUTE = 60_000;
/** Nunca pergunta de novo antes de 2 horas. */
const MIN_GAP_MS = 120 * MINUTE;
/** Depois das 2 horas, a pergunta vem num momento sorteado dentro das 2 horas seguintes. */
const RANDOM_WINDOW_MS = 120 * MINUTE;
/** Na janela sorteada, chance de pular a vez: assim a pergunta pode acontecer ou não. */
const SKIP_CHANCE = 0.3;
/** Primeira pergunta para quem nunca respondeu: entre 10 e 60 minutos depois de abrir o app. */
const FIRST_MIN_MS = 10 * MINUTE;
const FIRST_WINDOW_MS = 50 * MINUTE;
const CHECK_EVERY_MS = 30_000;

const nextKey = (userId: string) => `compasso:energy-next:${userId}`;

function readNext(userId: string): number | null {
  try {
    const value = Number(localStorage.getItem(nextKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveNext(userId: string, at: number) {
  try {
    localStorage.setItem(nextKey(userId), String(at));
  } catch {
    // Sem armazenamento, o sorteio vale só enquanto a página estiver aberta.
  }
}

/** Próximo horário possível: no mínimo 2 horas depois de `from`, num ponto sorteado da janela seguinte. */
const drawAfter = (from: number) => from + MIN_GAP_MS + Math.random() * RANDOM_WINDOW_MS;

/** "auto": pergunta sorteada; "manual": o usuário pediu pelo card. */
export type EnergyCheckMode = "auto" | "manual";

/**
 * Agenda o registro de energia em momentos aleatórios, com pelo menos 2 horas entre uma pergunta e outra.
 * Só abre com a página visível e `enabled` (fora da tela de boas-vindas e da sessão QP). O usuário também
 * pode abrir na hora (`openManual`); um registro manual reinicia o sorteio a partir do momento em que foi feito.
 */
export function useEnergyCheck(userId: string | undefined, enabled: boolean) {
  const [mode, setMode] = useState<EnergyCheckMode | null>(null);
  const open = mode !== null;
  const [nextAt, setNextAt] = useState<number | null>(() => (userId ? readNext(userId) : null));

  // Último registro no servidor: respeita o intervalo também quando a resposta veio de outro aparelho.
  const { data: last, isSuccess } = useQuery({
    queryKey: ["energy-last", userId],
    queryFn: () => api.get<{ recordedAt: string | null; score: number | null }>("/energy-checks/last"),
    enabled: !!userId,
  });

  const schedule = useCallback(
    (at: number) => {
      if (!userId) return;
      saveNext(userId, at);
      setNextAt(at);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId || !isSuccess) return;
    const lastAt = last?.recordedAt ? new Date(last.recordedAt).getTime() : null;
    const stored = readNext(userId);
    if (lastAt !== null && (stored === null || stored < lastAt + MIN_GAP_MS)) schedule(drawAfter(lastAt));
    else if (stored === null) schedule(Date.now() + FIRST_MIN_MS + Math.random() * FIRST_WINDOW_MS);
    else setNextAt(stored);
  }, [userId, isSuccess, last, schedule]);

  useEffect(() => {
    if (!enabled || open || nextAt === null) return;
    const check = () => {
      if (document.visibilityState !== "visible" || Date.now() < nextAt) return;
      // Pulou a vez: sorteia de novo a partir de agora, mantendo as 2 horas de intervalo.
      if (Math.random() < SKIP_CHANCE) schedule(drawAfter(Date.now()));
      else setMode("auto");
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, open, nextAt, schedule]);

  /** Abre o registro a pedido do usuário, sem esperar o horário sorteado. */
  const openManual = useCallback(() => setMode((current) => current ?? "manual"), []);

  /**
   * Fecha a pergunta. A sorteada, respondida ou adiada, sorteia a próxima a partir de agora; a manual só
   * mexe no sorteio quando foi registrada (desistir dela mantém o horário que já estava marcado).
   */
  const finish = useCallback(
    (recorded: boolean) => {
      if (mode === "auto" || recorded) schedule(drawAfter(Date.now()));
      setMode(null);
    },
    [mode, schedule],
  );

  const lastAt = last?.recordedAt ? new Date(last.recordedAt).getTime() : null;
  return { open, mode, lastAt, lastScore: last?.score ?? null, openManual, finish };
}
