export const LOCALES = ["pt-BR", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALE_COOKIE = "beatrush-locale";

/** `short` aparece no seletor; `name` é o nome do idioma em si mesmo. */
export const LOCALE_INFO: Record<Locale, { short: string; name: string }> = {
  "pt-BR": { short: "PT", name: "Português (Brasil)" },
  en: { short: "EN", name: "English" },
  es: { short: "ES", name: "Español" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Escolhe o idioma a partir do cabeçalho `Accept-Language`, respeitando os pesos (`q`).
 * Qualquer variante de pt/en/es é aceita (ex.: `pt-PT` → `pt-BR`, `en-GB` → `en`).
 * Idiomas não suportados caem no padrão do produto (pt-BR).
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const prefs = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((p) => p.tag && Number.isFinite(p.q) && p.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of prefs) {
    const base = tag.split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "en") return "en";
    if (base === "es") return "es";
  }
  return DEFAULT_LOCALE;
}
