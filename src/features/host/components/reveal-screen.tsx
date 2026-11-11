"use client";

import type { RoomView } from "@/features/realtime/protocol";
import { Avatar } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

const RANK_COLORS = ["#F59E0B", "#d9dbe6", "#c98a5a"];

export function RevealScreen({ view }: { view: RoomView }) {
  const { t, n } = useI18n();
  const reveal = view.round!.reveal!;
  const fastest = view.players
    .map((p) => ({ p, r: reveal.results[p.id] }))
    .filter(({ r }) => r?.correct)
    .sort((a, b) => b.r.points - a.r.points)
    .slice(0, 3);

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col bg-[radial-gradient(ellipse_at_30%_50%,#0b3a38,#0f0f12_70%)] p-8">
      <header className="flex justify-between text-2xl font-black">
        <span>
          {t("round.label", { n: view.round!.index + 1 })}{" "}
          <span className="font-bold text-muted">{t("round.of", { total: view.totalRounds })}</span>
        </span>
        <span className="text-sm font-extrabold tracking-[0.2em] text-cyan">{t("reveal.label")}</span>
      </header>

      <div className="flex flex-1 flex-col items-center gap-10 py-6 md:flex-row">
        {reveal.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={reveal.coverUrl}
            alt={t("reveal.coverAlt", { title: reveal.title })}
            className="size-64 rounded-2xl shadow-[0_0_50px_#00dfd855,0_0_0_3px_#00dfd8]"
          />
        ) : (
          <div className="flex size-64 items-center justify-center rounded-2xl bg-[repeating-linear-gradient(45deg,#22222e_0_12px,#1a1a24_12px_24px)] font-mono text-xs text-muted shadow-[0_0_50px_#00dfd855,0_0_0_3px_#00dfd8]">
            {t("reveal.noCover")}
          </div>
        )}

        <div className="flex-1">
          <p className="text-sm font-extrabold tracking-[0.2em] text-cyan">{t("reveal.correct")}</p>
          <p data-testid="reveal-title" className="my-2 text-5xl font-black leading-tight">
            {reveal.title}
          </p>
          <p className="mb-6 text-2xl font-semibold text-soft">{reveal.artist}</p>

          <p className="mb-2 text-xs font-extrabold tracking-[0.15em] text-muted">{t("reveal.fastest")}</p>
          {fastest.length === 0 ? (
            <p className="text-lg font-bold text-muted">{t("reveal.nobody")}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {fastest.map(({ p, r }, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3.5 rounded-xl border border-line bg-surface/80 px-4 py-2.5"
                >
                  <span className="w-5 text-lg font-black" style={{ color: RANK_COLORS[i] }}>
                    {i + 1}
                  </span>
                  <Avatar name={p.name} avatar={p.avatar} size={32} />
                  <span className="flex-1 text-lg font-extrabold">{p.name}</span>
                  <span className="text-sm font-semibold text-muted">
                    {n((r.elapsedMs ?? 0) / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s
                  </span>
                  <span className="text-lg font-black text-green">+{r.points}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
