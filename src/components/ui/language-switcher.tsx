"use client";

import { LOCALES, LOCALE_INFO } from "@/lib/i18n/locales";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Seletor PT / EN / ES. A escolha vale por aparelho (cookie) e é independente entre TV e celulares. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("language.label")}
      className={cn("flex gap-1 rounded-full border border-line-strong bg-surface/80 p-1 text-sm font-bold", className)}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          title={LOCALE_INFO[l].name}
          aria-label={LOCALE_INFO[l].name}
          aria-pressed={l === locale}
          onClick={() => setLocale(l)}
          className={cn(
            "rounded-full px-3 py-1.5 transition",
            l === locale ? "bg-brand text-white" : "text-muted hover:text-white",
          )}
        >
          {LOCALE_INFO[l].short}
        </button>
      ))}
    </div>
  );
}
