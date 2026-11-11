import type { Locale } from "../locales";
import { en } from "./en";
import { es } from "./es";
import { ptBR } from "./pt-BR";

export type MessageKey = keyof typeof ptBR;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<Locale, Messages> = { "pt-BR": ptBR, en, es };
