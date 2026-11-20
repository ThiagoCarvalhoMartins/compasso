import { useQuery } from "@tanstack/react-query";
import { addDays, type EnergyHour } from "@compasso/shared";
import { api } from "../lib/api";

/**
 * Média de energia por hora nos últimos `days` dias até `today`. Usa a mesma chave do Analytics, então o cache é
 * compartilhado e um novo registro de energia atualiza os dois.
 */
export function useEnergyHours(today: string | undefined, days = 30) {
  const from = today ? addDays(today, -(days - 1)) : undefined;
  const { data = [] } = useQuery({
    queryKey: ["energy-summary", from, today],
    queryFn: () => api.get<EnergyHour[]>(`/energy-checks/summary?from=${from}&to=${today}`),
    enabled: !!today,
  });
  return data;
}
