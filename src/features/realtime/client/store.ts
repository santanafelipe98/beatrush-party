import { create } from "zustand";
import type { RoomView, ServerMessage } from "../protocol";
import type { ConnectionStatus } from "./game-socket";

export interface GameStoreState {
  status: ConnectionStatus;
  view: RoomView | null;
  /** serverNow - Date.now() no momento do último snapshot. */
  clockOffset: number;
  error: string | null;
  hostCode: string | null;
  setStatus(s: ConnectionStatus): void;
  receive(m: ServerMessage, localNow?: number): void;
  clearError(): void;
  reset(): void;
}

const initial = {
  status: "closed" as ConnectionStatus,
  view: null,
  clockOffset: 0,
  error: null,
  hostCode: null,
};

export const useGameStore = create<GameStoreState>((set) => ({
  ...initial,
  setStatus: (status) => set({ status }),
  receive: (m, localNow = Date.now()) => {
    if (m.type === "state") set({ view: m.view, clockOffset: m.view.serverNow - localNow, error: null });
    else if (m.type === "host:created") set({ hostCode: m.code });
    else if (m.type === "error") set({ error: m.code });
  },
  clearError: () => set({ error: null }),
  reset: () => set({ ...initial }),
}));

/** Tradução dos códigos de erro para mensagens ao usuário. */
export const ERROR_MESSAGES: Record<string, string> = {
  room_not_found: "Sala não encontrada. Confira o código.",
  room_full: "A sala está cheia (máx. 8 jogadores).",
  name_taken: "Já existe alguém com esse nome na sala.",
  invalid_name: "Digite um nome.",
  wrong_phase: "A partida já começou.",
  not_enough_players: "São necessários pelo menos 2 jogadores.",
  not_host: "Só o anfitrião pode fazer isso.",
  time_over: "Tempo esgotado!",
  already_answered: "Você já respondeu.",
  bad_message: "Algo deu errado. Tente novamente.",
  not_joined: "Você ainda não entrou na sala.",
};
