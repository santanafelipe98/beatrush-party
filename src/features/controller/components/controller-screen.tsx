"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/features/realtime/client/store";
import { errorMessageKey } from "@/features/realtime/client/errors";
import { useI18n } from "@/lib/i18n/provider";
import { getPlayerId, usePlayerSession } from "@/features/realtime/client/hooks";
import { AnswerPad } from "./answer-pad";
import { GenrePicker } from "./genre-picker";
import { JoinForm, type JoinData } from "./join-form";
import { ResultScreen } from "./result-screen";
import { WaitingScreen } from "./waiting-screen";

/** Erros que, antes de entrar na sala, devolvem o jogador ao formulário. */
const JOIN_ERRORS = new Set(["room_not_found", "room_full", "name_taken", "invalid_name", "wrong_phase"]);

export function ControllerScreen({ initialCode }: { initialCode?: string }) {
  const [join, setJoin] = useState<JoinData | null>(null);
  // guarda o CÓDIGO do erro (não o texto) para o aviso acompanhar uma troca de idioma
  const [joinError, setJoinError] = useState<string | null>(null);
  const { t } = useI18n();

  if (!join) {
    return <JoinForm initialCode={initialCode} error={joinError ? t(errorMessageKey(joinError)) : null} onSubmit={(d) => { setJoinError(null); setJoin(d); }} />;
  }
  return (
    <Session
      key={`${join.code}:${join.name}`}
      join={join}
      onRejected={(code) => {
        setJoinError(code);
        setJoin(null);
      }}
    />
  );
}

function Session({ join, onRejected }: { join: JoinData; onRejected(errorCode: string): void }) {
  const { t } = useI18n();
  const send = usePlayerSession(join);
  const view = useGameStore((s) => s.view);
  const error = useGameStore((s) => s.error);
  const status = useGameStore((s) => s.status);
  const playerId = getPlayerId();

  useEffect(() => {
    if (!view && error && JOIN_ERRORS.has(error)) onRejected(error);
  }, [view, error, onRejected]);

  if (!view) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-lg font-bold text-muted">{t("join.entering")}</main>
    );
  }

  return (
    <main key={view.phase} className="animate-fade-up">
      {status !== "open" && (
        <div role="status" className="fixed inset-x-0 top-0 z-10 bg-amber py-1.5 text-center text-xs font-extrabold text-bg">
          {t("ctrl.reconnecting")}
        </div>
      )}
      {view.phase === "lobby" && (
        <WaitingScreen view={view} playerId={playerId} onStart={() => send({ type: "player:start" })} />
      )}
      {view.phase === "genre-vote" && (
        <GenrePicker
          voteEndsAt={view.voteEndsAt}
          submitted={view.you?.votes ?? null}
          onSubmit={(genres) => send({ type: "player:vote", genres })}
        />
      )}
      {(view.phase === "playing" || view.phase === "reveal") && view.round && (
        <AnswerPad view={view} playerId={playerId} onAnswer={(choice) => send({ type: "player:answer", choice })} />
      )}
      {view.phase === "finished" && (
        <ResultScreen view={view} playerId={playerId} onReplay={() => send({ type: "player:replay" })} />
      )}
    </main>
  );
}
