"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "./locales";
import { createTranslator, type Translator } from "./translate";

interface I18nValue extends Translator {
  setLocale(locale: Locale): void;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

// Sem provider (ex.: testes de componentes isolados) usa o idioma padrão.
const I18nContext = createContext<I18nValue>({ ...createTranslator(DEFAULT_LOCALE), setLocale: () => {} });

/**
 * `initialLocale` vem do servidor (cookie/Accept-Language), então o HTML inicial já sai
 * no idioma certo, sem "piscar" de um idioma para outro na hidratação.
 */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
    setLocaleState(next);
  }, []);

  const value = useMemo<I18nValue>(() => ({ ...createTranslator(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
