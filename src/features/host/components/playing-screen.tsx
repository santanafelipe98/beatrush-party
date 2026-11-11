"use client";

import type { RoomView } from "@/features/realtime/protocol";
import { useCountdown } from "@/features/realtime/client/hooks";
import { useI18n } from "@/lib/i18n/provider";
import { CountdownRing, Equalizer, SHAPE_TV_COLORS, ShapeIcon } from "@/components/ui";

export function PlayingScreen({ view }: { view: RoomView }) {
  const { t } = useI18n();
  const round = view.round!;
  const seconds = useCountdown(round.startedAt + round.durationMs);
  const connected = view.players.filter((p) => p.connected);
  const answered = connected.filter((p) => round.answeredIds.includes(p.id)).length;
  const pct = Math.min(100, (seconds * 1000 * 100) / round.durationMs);

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col gap-4 bg-[radial-gradient(ellipse_at_50%_0%,#2a0f4a,#0f0f12_70%)] p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-black">
          {t("round.label", { n: round.index + 1 })}{" "}
          <span className="font-bold text-muted">{t("round.of", { total: view.totalRounds })}</span>
        </h1>
        <div className="flex h-8 items-center gap-2">
          <Equalizer bars={7} seed={4} origin="center" className="h-full w-16" barClassName="bg-pink" />
          <span className="animate-glow text-sm font-extrabold tracking-[0.15em] text-pink">{t("play.nowPlaying")}</span>
        </div>
      </header>

      <div role="progressbar" aria-label={t("play.timeLabel")} aria-valuenow={Math.round(pct)} className="h-2 rounded bg-track">
        <div
          className="h-full rounded bg-gradient-to-r from-cyan to-green shadow-[0_0_14px_#00dfd888]"
          style={{ width: `${pct}%`, transition: "width 150ms linear" }}
        />
      </div>

      <div className="flex items-center justify-center gap-6 sm:gap-12">
        <Equalizer bars={16} seed={2} origin="center" className="hidden h-24 w-40 sm:flex" barClassName="bg-pink" />
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-center text-3xl font-black">{t("play.question")}</h2>
          <CountdownRing seconds={seconds} percent={pct} size={132} />
        </div>
        <Equalizer bars={16} seed={5} origin="center" className="hidden h-24 w-40 sm:flex" barClassName="bg-purple" />
      </div>

      <ul className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
        {round.options.map((o, i) => (
          <li
            key={i}
            data-testid={`tv-option-${i}`}
            className="flex min-h-24 items-center gap-5 rounded-3xl px-7"
            style={{ background: SHAPE_TV_COLORS[i], boxShadow: `0 0 30px ${SHAPE_TV_COLORS[i]}55` }}
          >
            <ShapeIcon index={i} className="size-14 flex-none" />
            <div>
              <p className="text-3xl font-black leading-tight">{o.title}</p>
              <p className="text-base font-semibold opacity-85">{o.artist}</p>
            </div>
          </li>
        ))}
      </ul>

      <footer className="flex flex-col items-center gap-2">
        <p className="text-lg font-bold">
          <span className="font-black text-cyan">
            {answered}/{connected.length}
          </span>{" "}
          {t("play.answeredSuffix")}
        </p>
        <div className="flex gap-2">
          {view.players.map((p) => {
            const done = round.answeredIds.includes(p.id);
            return (
              <span
                key={p.id}
                title={p.name}
                className="flex size-9 items-center justify-center rounded-full border-2 text-sm font-black text-bg"
                style={{ background: done ? "#00DFD8" : "#22222e", borderColor: done ? "#00DFD8" : "#F59E0B" }}
              >
                {done ? p.name.charAt(0).toUpperCase() : "…"}
              </span>
            );
          })}
        </div>
      </footer>
    </div>
  );
}
