import { ptBR, type MessageKey } from "./pt-BR";

export const messages = ptBR;

/** Traduz uma chave, trocando {param} pelos valores informados. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}
