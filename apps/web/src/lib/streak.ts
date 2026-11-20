import type { BlockDTO, BlockLogStatus } from "@compasso/shared";
import { WEEKDAY_LABELS } from "./time";
import { weekdayOf } from "@compasso/shared";

/** Bloco do dia como a tela Compasso recebe: registro de hoje e histórico de falhas seguidas. */
export type CompassBlock = BlockDTO & { log: BlockLogStatus | null; previousMisses: number; previousDate: string | null };

/** Energia em até 4 (de 0 a 10) registrada nas últimas 3 horas: hora de sugerir a versão de 2 minutos com destaque. */
const LOW_ENERGY_SCORE = 4;
const LOW_ENERGY_WINDOW_MS = 3 * 60 * 60 * 1000;

export function isLowEnergy(lastScore: number | null, lastAt: number | null, now: number) {
  return lastScore !== null && lastAt !== null && lastScore <= LOW_ENERGY_SCORE && now - lastAt <= LOW_ENERGY_WINDOW_MS;
}

const dayLabel = (date: string) => `${WEEKDAY_LABELS[weekdayOf(date)].toLowerCase()}, ${date.slice(8, 10)}/${date.slice(5, 7)}`;

/**
 * Nunca falhe duas vezes (Hábitos Atômicos). Só aparece enquanto o bloco de hoje ainda não foi marcado.
 * Uma falha: convite a não repetir. Duas ou mais: sem culpa, o que conta é recomeçar.
 */
export function missReminder(block: CompassBlock): { badge: string; message: string } | null {
  if (block.log || block.previousMisses === 0) return null;
  const minimum = block.minimumVersion ? ` Nem que seja a versão de 2 minutos: “${block.minimumVersion}”.` : "";
  if (block.previousMisses === 1) {
    const when = block.previousDate ? ` (${dayLabel(block.previousDate)})` : "";
    return {
      badge: "Não falhe duas vezes",
      message: `Na última vez${when} não deu. Hoje é o dia de não falhar duas vezes.${minimum}`,
    };
  }
  return { badge: "Recomeçar", message: `Recomeçar é o que conta. Hoje é um bom dia para retomar.${minimum}` };
}
