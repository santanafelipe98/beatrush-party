"use client";

import { useState } from "react";
import { GENRES, MAX_GENRE_PICKS, type Genre } from "@/features/game";
import { useCountdown } from "@/features/realtime/client/hooks";
import { Button, ProgressBar, TimerPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";

interface GenrePickerProps {
  voteEndsAt: number | null;
  /** Votos já enviados (vindos do servidor). */
  submitted: Genre[] | null;
  onSubmit(genres: Genre[]): void;
}

export function GenrePicker({ voteEndsAt, submitted, onSubmit }: GenrePickerProps) {
  const { t } = useI18n();
  const [picks, setPicks] = useState<Genre[]>([]);
  const seconds = useCountdown(voteEndsAt);
  const locked = submitted !== null;
  const shown = locked ? submitted : picks;

  const toggle = (g: Genre) =>
    setPicks((p) => (p.includes(g) ? p.filter((x) => x !== g) : p.length < MAX_GENRE_PICKS ? [...p, g] : p));

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col gap-3 px-5 pb-6 pt-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black">{t("picker.title", { max: MAX_GENRE_PICKS })}</h1>
        <TimerPill seconds={seconds} className="text-base" />
      </div>
      <ProgressBar label={t("vote.timeLabel")} value={(seconds / 20) * 100} fillClassName="bg-gradient-to-r from-amber to-red" />

      <div className="mt-1 grid grid-cols-2 gap-2.5">
        {GENRES.map((g) => {
          const on = shown.includes(g);
          return (
            <button
              key={g}
              type="button"
              disabled={locked}
              aria-pressed={on}
              onClick={() => toggle(g)}
              className={cn(
                "relative flex h-16 items-center justify-center rounded-2xl border-2 text-[15px] font-extrabold transition",
                on ? "border-pink bg-gradient-to-br from-pink to-purple" : "border-line bg-surface",
                locked && "opacity-80",
              )}
            >
              {t(`genre.${g}`)}
              {on && <span className="absolute right-2 top-1.5 text-[11px]">✓</span>}
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs font-bold text-muted">
        {t("picker.selected", { n: shown.length, max: MAX_GENRE_PICKS })}
      </p>
      <Button
        variant="accent"
        disabled={locked || picks.length === 0}
        onClick={() => onSubmit(picks)}
        className="mt-auto font-black"
      >
        {locked ? t("picker.sent") : t("picker.submit")}
      </Button>
    </div>
  );
}
