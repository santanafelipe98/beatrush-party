"use client";

import { useState } from "react";
import { useGameStore } from "@/features/realtime/client/store";
import { useHostSession } from "@/features/realtime/client/hooks";
import { DeezerLogo, LanguageSwitcher } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { FinalScreen } from "./final-screen";
import { GenreVoteScreen } from "./genre-vote-screen";
import { HostAudio } from "./host-audio";
import { LobbyScreen } from "./lobby-screen";
import { PlayingScreen } from "./playing-screen";
import { RevealScreen } from "./reveal-screen";

/** Altura do rodapé (logo + controles). As telas usam `min-h-[calc(100dvh-4rem)]` para caber junto. */
const FOOTER = "h-16";

export function HostScreen() {
  useHostSession();
  const { t } = useI18n();
  const view = useGameStore((s) => s.view);
  const status = useGameStore((s) => s.status);
  const [muted, setMuted] = useState(false);

  const joinUrl = view ? `${window.location.origin}/play?code=${view.code}` : "";

  return (
    <main className="relative flex min-h-dvh flex-col">
      <div className="flex-1">
        {!view ? (
          <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center text-xl font-bold text-muted">
            {status === "open" ? t("host.creating") : t("host.connecting")}
          </div>
        ) : (
          <div key={view.phase} className="animate-fade-up">
            {view.phase === "lobby" && <LobbyScreen view={view} joinUrl={joinUrl} />}
            {view.phase === "genre-vote" && <GenreVoteScreen view={view} />}
            {view.phase === "playing" && <PlayingScreen view={view} />}
            {view.phase === "reveal" && <RevealScreen view={view} />}
            {view.phase === "finished" && <FinalScreen view={view} />}
          </div>
        )}
      </div>

      {view && <HostAudio src={view.phase === "playing" ? view.round?.previewUrl : undefined} muted={muted} />}

      {/* O logo do Deezer é obrigatório (API) e fica visível em TODAS as telas da TV, sem cobrir conteúdo. */}
      <footer className={`flex ${FOOTER} items-center justify-between border-t border-line bg-bg px-6`}>
        <DeezerLogo height={32} />
        <div className="flex gap-2 text-sm font-bold">
          {status !== "open" && (
            <span className="rounded-full border border-amber bg-amber/15 px-4 py-2 text-amber">
              {t("host.reconnecting")}
            </span>
          )}
          <LanguageSwitcher />
          <button
            type="button"
            aria-pressed={!muted}
            onClick={() => setMuted((m) => !m)}
            className="rounded-full border border-line-strong bg-surface/80 px-4 py-2"
          >
            {muted ? t("host.soundOff") : t("host.soundOn")}
          </button>
        </div>
      </footer>
    </main>
  );
}
