"use client";

import { GENRES } from "@/features/game";
import type { RoomView } from "@/features/realtime/protocol";
import { useCountdown } from "@/features/realtime/client/hooks";
import { ProgressBar, TimerPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";

const TOP_COLORS = ["#FF0080", "#7928CA", "#00DFD8"];

export function GenreVoteScreen({ view }: { view: RoomView }) {
  const { t } = useI18n();
  const seconds = useCountdown(view.voteEndsAt);
  const connected = view.players.filter((p) => p.connected).length || 1;
  const tally = view.tally ?? GENRES.map((genre) => ({ genre, votes: 0 }));
  const ranked = [...tally].sort((a, b) => b.votes - a.votes);
  const rankOf = (g: string) => ranked.findIndex((r) => r.genre === g);
  const total = view.voteEndsAt ? Math.max(1, view.voteEndsAt - view.serverNow) : 1;
  const maxVotes = Math.max(1, ...tally.map((r) => r.votes));

  return (
    <div className="flex min-h-dvh flex-col gap-4 bg-bg p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-black">{t("vote.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-muted">
            {t("vote.votes", { done: view.votedIds.length, total: view.players.length })}
          </span>
          <TimerPill seconds={seconds} className="text-2xl" />
        </div>
      </header>
      <ProgressBar
        label={t("vote.timeLabel")}
        value={(seconds * 1000 * 100) / Math.max(total, seconds * 1000)}
        fillClassName="bg-gradient-to-r from-amber to-red"
      />

      <ul className="grid flex-1 grid-cols-1 gap-x-9 gap-y-3 sm:grid-cols-2">
        {GENRES.map((genre) => {
          const votes = tally.find((r) => r.genre === genre)?.votes ?? 0;
          const pct = Math.round((votes / connected) * 100);
          const r = rankOf(genre);
          const top = votes > 0 && r < 3;
          return (
            <li key={genre} className={cn("flex flex-col justify-center gap-1.5", !top && "opacity-60")}>
              <div className="flex justify-between text-lg font-extrabold">
                <span>
                  {top && `#${r + 1} `}
                  {t(`genre.${genre}`)}
                </span>
                <span style={{ color: top ? TOP_COLORS[r] : "#9a9aab" }}>{pct}%</span>
              </div>
              <div className="h-4 overflow-hidden rounded-lg bg-surface-2">
                <div
                  className="h-full rounded-lg transition-[width] duration-300"
                  style={{
                    width: `${(votes / maxVotes) * (pct || 0)}%`,
                    background: top ? TOP_COLORS[r] : "#444458",
                    boxShadow: top ? `0 0 14px ${TOP_COLORS[r]}88` : "none",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-3">
        <span className="text-xs font-extrabold tracking-[0.15em] text-cyan">{t("vote.top3")}</span>
        {ranked
          .slice(0, 3)
          .filter((r) => r.votes > 0)
          .map((r, i) => (
            <span
              key={r.genre}
              className="rounded-full px-5 py-2 text-lg font-extrabold"
              style={{ background: TOP_COLORS[i], color: i === 2 ? "#0f0f12" : "#fff" }}
            >
              #{i + 1} {t(`genre.${r.genre}`)}
            </span>
          ))}
      </footer>
    </div>
  );
}
