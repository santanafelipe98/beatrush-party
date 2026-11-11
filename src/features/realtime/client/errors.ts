import { MESSAGES, type MessageKey } from "@/lib/i18n/messages";

/** Código de erro do servidor → chave de tradução (`error.fallback` se desconhecido). */
export function errorMessageKey(code: string): MessageKey {
  const key = `error.${code}`;
  return key in MESSAGES["pt-BR"] ? (key as MessageKey) : "error.fallback";
}
