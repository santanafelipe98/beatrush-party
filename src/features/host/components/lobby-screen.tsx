"use client";

import { MAX_PLAYERS, MIN_PLAYERS } from "@/features/game";
import type { RoomView } from "@/features/realtime/protocol";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n/provider";
import { QrCode } from "./qr-code";

export function LobbyScreen({ view, joinUrl }: { view: RoomView; joinUrl: string }) {
  const { t } = useI18n();
  const host = view.players.find((p) => p.id === view.hostPlayerId);
  const slots = Math.min(MAX_PLAYERS, Math.max(4, view.players.length + 1));
  const ready = view.players.filter((p) => p.connected).length >= MIN_PLAYERS;

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 bg-bg lg:grid-cols-[minmax(320px,0.42fr)_1fr]">
      <section className="flex flex-col items-center gap-3 border-b border-line bg-gradient-to-b from-[#1d0f33] to-surface p-8 lg:border-b-0 lg:border-r">
        <p className="text-sm font-bold tracking-[0.2em] text-muted">{t("lobby.code")}</p>
        <p
          data-testid="room-code"
          className="text-7xl font-black leading-none tracking-[0.08em] [text-shadow:0_0_30px_#ff0080] sm:text-8xl"
        >
          {view.code}
        </p>
        <QrCode value={joinUrl} />
        <p className="text-base font-bold text-muted">
          {t("lobby.orVisit")} <span className="text-cyan">{joinUrl.replace(/^https?:\/\//, "")}</span>
        </p>
      </section>

      <section className="flex flex-col gap-4 p-8">
        <div className="flex items-baseline justify-between">
          <h1 className="text-3xl font-extrabold">{t("lobby.players")}</h1>
          <p className="text-lg font-bold text-cyan">
            {t("lobby.connected", { count: view.players.length, max: MAX_PLAYERS })}
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: slots }, (_, i) => {
            const p = view.players[i];
            return p ? (
              <li
                key={p.id}
                className="flex h-16 items-center gap-3.5 rounded-2xl border border-line-strong bg-surface px-4"
              >
                <Avatar name={p.name} avatar={p.avatar} />
                <div>
                  <p className="text-xl font-extrabold">
                    {p.name}
                    {p.id === view.hostPlayerId && ` ${t("lobby.hostTag")}`}
                  </p>
                  <p className="text-xs font-semibold opacity-70">
                    {p.connected ? t("lobby.ready") : t("lobby.offline")}
                  </p>
                </div>
              </li>
            ) : (
              <li
                key={`empty-${i}`}
                className="flex h-16 items-center gap-3.5 rounded-2xl border-2 border-dashed border-line-strong px-4 text-[#6b6b80]"
              >
                <Avatar name="+" avatar={9} size={44} className="!bg-track !text-[#6b6b80]" />
                <div>
                  <p className="text-xl font-extrabold">{t("lobby.waiting")}</p>
                  <p className="text-xs font-semibold opacity-70">{t("lobby.freeSlot")}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div
          className={cn(
            "mt-auto rounded-2xl p-5 text-center text-xl font-extrabold",
            ready ? "bg-brand shadow-[0_0_30px_#ff008055]" : "bg-surface-2 text-muted",
          )}
        >
          {ready
            ? t("lobby.canStart", { name: host?.name ?? t("lobby.hostFallback") })
            : t("lobby.needPlayers", { min: MIN_PLAYERS })}
        </div>
      </section>
    </div>
  );
}
