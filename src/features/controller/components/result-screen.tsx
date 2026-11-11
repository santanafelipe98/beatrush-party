"use client";

import type { RoomView } from "@/features/realtime/protocol";
import { Button } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

interface ResultScreenProps {
  view: RoomView;
  playerId: string;
  onReplay(): void;
}

const MEDALS = [
  "linear-gradient(135deg,#ffd75e,#F59E0B)",
  "linear-gradient(135deg,#d9dbe6,#8b8da0)",
  "linear-gradient(135deg,#e0a06a,#a8693a)",
];

export function ResultScreen({ view, playerId, onReplay }: ResultScreenProps) {
  const { t, n, ordinal } = useI18n();
  const sorted = [...view.players].sort((a, b) => b.score - a.score || b.bestStreak - a.bestStreak);
  const place = sorted.findIndex((p) => p.id === playerId) + 1;
  const me = sorted[place - 1];
  const total = view.totalRounds;
  const accuracy = total ? Math.round(((me?.correct ?? 0) / total) * 100) : 0;
  const voted = view.replayVotes.includes(playerId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center gap-3.5 bg-[radial-gradient(ellipse_at_50%_20%,#3d1070,#0f0f12_70%)] px-5 pb-6 pt-14 text-center">
      <p className="text-xs font-extrabold tracking-[0.2em] text-muted">{t("result.title")}</p>
      <div
        data-testid="my-place"
        className="flex size-28 items-center justify-center rounded-full text-6xl font-black text-bg shadow-[0_0_40px_#ffffff44]"
        style={{ background: MEDALS[place - 1] ?? "linear-gradient(135deg,#444458,#2a2a38)" }}
      >
        {ordinal(place)}
      </div>
      <h1 className="text-2xl font-black leading-tight">{t("result.place", { place: ordinal(place) })}</h1>
      <p className="text-4xl font-black leading-none text-cyan">
        {n(me?.score ?? 0)}
        <span className="text-base text-muted"> {t("result.pts")}</span>
      </p>

      <div className="mt-1.5 w-full rounded-2xl border border-line bg-surface p-4">
        <p className="text-base font-extrabold">
          {t("result.hitsPre")} <span className="text-green">{me?.correct ?? 0}</span> {t("result.hitsPost", { total })}
        </p>
        <div className="mt-2.5 h-2 rounded bg-track">
          <div className="h-full rounded bg-green" style={{ width: `${accuracy}%` }} />
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">
          {t("result.accuracy", { pct: accuracy, streak: me?.bestStreak ?? 0 })}
        </p>
      </div>

      <Button disabled={voted} onClick={onReplay} className="mt-auto w-full">
        {voted ? t("result.replayed", { done: view.replayVotes.length, total: view.players.length }) : t("result.replay")}
      </Button>
    </div>
  );
}
