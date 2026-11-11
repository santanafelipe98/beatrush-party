import type { Room } from "@/features/game";
import type { RoundTracks } from "@/features/music";

/** Formato do snapshot persistido. Suba o número ao mudar a forma de `RoomSnapshot`. */
export const SNAPSHOT_VERSION = 1;

/** Qual ação o servidor tem agendada para uma sala, e quando (epoch ms). */
export type DeadlineAction = "endVote" | "nextRound" | "endRound" | "afterReveal";
export interface Deadline {
  action: DeadlineAction;
  at: number;
}

/** Tudo que é preciso para retomar uma sala após reiniciar o servidor. */
export interface RoomSnapshot {
  v: number;
  room: Room;
  /** Músicas das próximas rodadas (já sorteadas). */
  queue: RoundTracks[];
  deadline: Deadline | null;
  savedAt: number;
}

/** Armazenamento de salas. As conexões WebSocket e os timers NÃO são persistidos (são do processo). */
export interface RoomStore {
  save(snapshot: RoomSnapshot): Promise<void>;
  remove(code: string): Promise<void>;
  loadAll(): Promise<RoomSnapshot[]>;
}

/**
 * Subconjunto do cliente Redis que usamos. Permite testar com um falso e
 * não acoplar o resto do código à biblioteca.
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  scan(cursor: string, match: "MATCH", pattern: string, count: "COUNT", n: number): Promise<[string, string[]]>;
}
