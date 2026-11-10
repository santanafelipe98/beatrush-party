"use client";

import { useState } from "react";
import { useGameStore } from "@/features/realtime/client/store";
import { useHostSession } from "@/features/realtime/client/hooks";
import { FinalScreen } from "./final-screen";
import { GenreVoteScreen } from "./genre-vote-screen";
import { HostAudio } from "./host-audio";
import { LobbyScreen } from "./lobby-screen";
import { PlayingScreen } from "./playing-screen";
import { RevealScreen } from "./reveal-screen";

export function HostScreen() {
  useHostSession();
  const view = useGameStore((s) => s.view);
  const status = useGameStore((s) => s.status);
  const [muted, setMuted] = useState(false);

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-xl font-bold text-muted">
        {status === "open" ? "Criando sala…" : "Conectando…"}
      </main>
    );
  }

  const joinUrl = `${window.location.origin}/play?code=${view.code}`;

  return (
    <main className="relative">
      {view.phase === "lobby" && <LobbyScreen view={view} joinUrl={joinUrl} />}
      {view.phase === "genre-vote" && <GenreVoteScreen view={view} />}
      {view.phase === "playing" && <PlayingScreen view={view} />}
      {view.phase === "reveal" && <RevealScreen view={view} />}
      {view.phase === "finished" && <FinalScreen view={view} />}

      <HostAudio src={view.phase === "playing" ? view.round?.previewUrl : undefined} muted={muted} />

      <div className="fixed right-4 top-4 flex gap-2 text-sm font-bold">
        {status !== "open" && (
          <span className="rounded-full border border-amber bg-amber/15 px-4 py-2 text-amber">Reconectando…</span>
        )}
        <button
          type="button"
          aria-pressed={!muted}
          onClick={() => setMuted((m) => !m)}
          className="rounded-full border border-line-strong bg-surface/80 px-4 py-2"
        >
          Som: {muted ? "OFF" : "ON"}
        </button>
      </div>
    </main>
  );
}
