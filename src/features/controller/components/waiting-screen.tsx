"use client";

import { MIN_PLAYERS } from "@/features/game";
import type { RoomView } from "@/features/realtime/protocol";
import { Avatar, Button, Equalizer } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

interface WaitingScreenProps {
  view: RoomView;
  playerId: string;
  onStart(): void;
}

export function WaitingScreen({ view, playerId, onStart }: WaitingScreenProps) {
  const { t } = useI18n();
  const me = view.players.find((p) => p.id === playerId);
  const isHost = view.hostPlayerId === playerId;
  const connected = view.players.filter((p) => p.connected).length;
  const canStart = isHost && connected >= MIN_PLAYERS;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-4 bg-[radial-gradient(ellipse_at_50%_40%,#0b3a38,#0f0f12_70%)] px-6 text-center">
      <Avatar name={me?.name ?? "?"} avatar={me?.avatar ?? 0} size={96} glow className="animate-pulse-beat" />
      <h1 className="text-3xl font-black leading-tight">{t("waiting.in")}</h1>
      <p className="text-lg font-semibold text-soft">{t("waiting.lookTv")}</p>
      <Equalizer bars={7} seed={4} className="h-8 w-16" barClassName="bg-cyan" />
      <p className="text-sm font-semibold text-muted">
        {t("waiting.room", { code: view.code, count: view.players.length })}
      </p>

      {isHost && (
        <Button disabled={!canStart} onClick={onStart} className="mt-4 w-full">
          {t("waiting.start")}
        </Button>
      )}
      {isHost && !canStart && <p className="text-xs text-muted">{t("waiting.activeWith", { min: MIN_PLAYERS })}</p>}
      {!isHost && <p className="text-xs text-muted">{t("waiting.waitHost")}</p>}
    </div>
  );
}
