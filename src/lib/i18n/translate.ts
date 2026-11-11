import { DEFAULT_LOCALE, type Locale } from "./locales";
import { MESSAGES, type MessageKey } from "./messages";

export type Params = Record<string, string | number>;
export type TFunction = (key: MessageKey, params?: Params) => string;

export interface Translator {
  locale: Locale;
  t: TFunction;
  /** Formata números conforme o idioma (separador decimal e de milhar). */
  n(value: number, options?: Intl.NumberFormatOptions): string;
  /** 1º / 1st / 1º. */
  ordinal(value: number): string;
}

const INTL_LOCALE: Record<Locale, string> = { "pt-BR": "pt-BR", en: "en-US", es: "es-ES" };

export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Função pura (usável no servidor e no cliente): idioma → tradutor. */
export function createTranslator(locale: Locale = DEFAULT_LOCALE): Translator {
  const messages = MESSAGES[locale];
  const intl = INTL_LOCALE[locale];
  return {
    locale,
    t: (key, params) => interpolate(messages[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key, params),
    n: (value, options) => new Intl.NumberFormat(intl, options).format(value),
    ordinal: (value) => {
      if (locale !== "en") return `${value}º`;
      const suffix = { one: "st", two: "nd", few: "rd", other: "th" }[
        new Intl.PluralRules("en-US", { type: "ordinal" }).select(value) as "one" | "two" | "few" | "other"
      ];
      return `${value}${suffix}`;
    },
  };
}
