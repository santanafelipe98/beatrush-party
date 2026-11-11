import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "./locales";
import { createTranslator } from "./translate";

/** Idioma da requisição: cookie (escolha do usuário) > Accept-Language > padrão. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiateLocale((await headers()).get("accept-language"));
}

export async function getTranslator() {
  return createTranslator(await getLocale());
}
