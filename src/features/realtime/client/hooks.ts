"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage } from "../protocol";
import { GameSocket, defaultWsUrl } from "./game-socket";
import { useGameStore } from "./store";

const HOST_CODE_KEY = "beatrush:host-code";
const PLAYER_ID_KEY = "beatrush:player-id";

function safeStorage(kind: "session" | "local") {
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

/** Id estável do jogador neste aparelho (permite reconexão). */
export function getPlayerId(): string {
  const store = safeStorage("local");
  let id = store?.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    store?.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

function useSocket(openMessages: () => ClientMessage[]) {
  const ref = useRef<GameSocket | null>(null);
  const messagesRef = useRef(openMessages);
  useEffect(() => {
    messagesRef.current = openMessages;
  });

  useEffect(() => {
    const store = useGameStore.getState();
    const socket = new GameSocket({
      url: defaultWsUrl(),
      onOpenMessages: () => messagesRef.current(),
      onMessage: (m) => {
        // a TV tenta reanexar; se a sala expirou, cria outra
        if (m.type === "error" && m.code === "room_not_found" && safeStorage("session")?.getItem(HOST_CODE_KEY)) {
          safeStorage("session")?.removeItem(HOST_CODE_KEY);
          socket.send({ type: "host:create" });
          return;
        }
        if (m.type === "host:created") safeStorage("session")?.setItem(HOST_CODE_KEY, m.code);
        useGameStore.getState().receive(m);
      },
      onStatus: (s) => useGameStore.getState().setStatus(s),
    });
    ref.current = socket;
    socket.connect();
    return () => {
      socket.close();
      store.reset();
    };
  }, []);

  return useCallback((m: ClientMessage) => ref.current?.send(m) ?? false, []);
}

/** Sessão da TV: cria (ou reanexa a) uma sala. */
export function useHostSession() {
  useSocket(() => {
    const code = safeStorage("session")?.getItem(HOST_CODE_KEY);
    return [code ? { type: "host:attach", code } : { type: "host:create" }];
  });
}

/** Sessão do celular: entra na sala e devolve `send`. */
export function usePlayerSession(join: { code: string; name: string; avatar: number } | null) {
  return useSocket(() => {
    const j = join;
    return j ? [{ type: "player:join", playerId: getPlayerId(), ...j }] : [];
  });
}

/** Segundos restantes até `endsAt` (relógio do servidor), atualizando a cada 100ms. */
export function useCountdown(endsAt: number | null | undefined): number {
  const offset = useGameStore((s) => s.clockOffset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [endsAt]);
  if (endsAt == null) return 0;
  return Math.max(0, (endsAt - (now + offset)) / 1000);
}
