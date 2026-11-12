/**
 * Guarda se o usuário já iniciou o dia e se pausou as notificações, para não pedir
 * "Iniciar meu dia" de novo a cada recarregamento.
 * - ausente: ainda não iniciou neste navegador;
 * - "on": alertas ativos;
 * - "paused": iniciou, mas pausou as notificações.
 */
export type AlertsPreference = "on" | "paused" | null;

const STORAGE_KEY = "compasso:alerts";

export function readAlertsPreference(): AlertsPreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "on" || value === "paused" ? value : null;
  } catch {
    return null;
  }
}

export function saveAlertsPreference(value: Exclude<AlertsPreference, null>) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Sem armazenamento, a escolha vale só para esta visita.
  }
}
