import Redis from "ioredis";
import { NullRoomStore } from "./memory-stores";
import { RedisRoomStore } from "./redis-stores";
import type { RedisLike, RoomStore } from "./types";

export * from "./types";
export * from "./memory-stores";
export * from "./redis-stores";

export interface Persistence {
  kind: "redis" | "memory";
  roomStore: RoomStore;
  close(): Promise<void>;
}

/** Evita inundar o log quando o Redis cai: no máximo 1 aviso por intervalo. */
function throttledLogger(intervalMs = 30_000) {
  let last = 0;
  return (message: string, error?: unknown) => {
    const now = Date.now();
    if (now - last < intervalMs) return;
    last = now;
    console.warn(message, error instanceof Error ? error.message : (error ?? ""));
  };
}

/**
 * Sem `REDIS_URL`: tudo em memória (salas não sobrevivem a reinício), como antes.
 * Com `REDIS_URL`: salas no Redis. Se o Redis estiver configurado mas inacessível na
 * subida, falha na hora (melhor que rodar achando que persiste). Depois de no ar, uma queda
 * do Redis só degrada: o jogo segue em memória e as gravações voltam quando ele retornar.
 */
export async function createPersistence(env: Record<string, string | undefined> = process.env): Promise<Persistence> {
  const url = env.REDIS_URL;
  if (!url) {
    return { kind: "memory", roomStore: new NullRoomStore(), close: async () => {} };
  }

  const warn = throttledLogger();
  const redis = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 5_000,
    maxRetriesPerRequest: 1,
    // comandos durante uma queda falham na hora em vez de acumular em fila
    enableOfflineQueue: false,
  });
  redis.on("error", (e) => warn("[redis] erro de conexão:", e));
  redis.on("ready", () => console.log("[redis] conectado"));

  try {
    await redis.connect();
    await redis.ping();
  } catch (e) {
    redis.disconnect();
    throw new Error(`REDIS_URL definido, mas o Redis não respondeu (${(e as Error).message})`);
  }

  const client = redis as unknown as RedisLike;
  const prefix = env.REDIS_PREFIX || "beatrush:";
  const roomTtlSeconds = env.ROOM_TTL_SECONDS ? Number(env.ROOM_TTL_SECONDS) : undefined;
  return {
    kind: "redis",
    roomStore: new RedisRoomStore(client, { prefix, roomTtlSeconds, log: warn }),
    close: async () => {
      await redis.quit().catch(() => redis.disconnect());
    },
  };
}
