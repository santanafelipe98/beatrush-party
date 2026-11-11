"use client";

import Link from "next/link";
import { Equalizer, LanguageSwitcher } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export function HomeScreen() {
  const { t } = useI18n();
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#2a0f4a_0%,#0f0f12_65%)] px-6 text-center">
      <Equalizer
        bars={48}
        seed={3}
        className="absolute inset-x-5 bottom-0 h-1/3 opacity-50"
        barClassName="rounded-t bg-gradient-to-b from-pink to-purple"
      />

      <LanguageSwitcher className="absolute right-6 top-6" />

      <div className="relative flex flex-col items-center gap-2">
        <h1 className="text-brand animate-pulse-beat text-6xl font-black leading-none tracking-tight drop-shadow-[0_0_28px_#ff008066] sm:text-8xl">
          BEATRUSH
        </h1>
        <p className="mr-[-0.7em] text-xl font-extrabold tracking-[0.7em] text-cyan sm:text-2xl">PARTY</p>

        <Link
          href="/host"
          className="bg-brand mt-8 rounded-2xl px-10 py-5 text-xl font-extrabold shadow-[0_0_40px_#ff008066,0_0_0_4px_#ffffff33] transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-14 sm:text-2xl"
        >
          {t("home.create")}
        </Link>
        <Link href="/play" className="mt-2 text-sm font-bold text-cyan underline-offset-4 hover:text-pink hover:underline">
          {t("home.join")}
        </Link>
        <p className="mt-1 text-sm text-muted">{t("app.tagline")}</p>
      </div>
    </main>
  );
}
