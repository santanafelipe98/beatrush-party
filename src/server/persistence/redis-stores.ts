import { SNAPSHOT_VERSION, type RedisLike, type RoomSnapshot, type RoomStore } from "./types";

export interface RedisStoreOptions {
  /** Prefixo das chaves (permite compartilhar um Redis com outros apps/ambientes). */
  prefix?: string;
  /** Validade do snapshot; é renovada a cada gravação, então só expira sala abandonada. */
  roomTtlSeconds?: number;
  log?: (message: string, error?: unknown) => void;
}

export class RedisRoomStore implements RoomStore {
  private prefix: string;
  private ttl: number;
  private log: NonNullable<RedisStoreOptions["log"]>;

  constructor(
    private redis: RedisLike,
    options: RedisStoreOptions = {},
  ) {
    this.prefix = options.prefix ?? "beatrush:";
    this.ttl = options.roomTtlSeconds ?? 6 * 60 * 60;
    this.log = options.log ?? ((m, e) => console.warn(m, e ?? ""));
  }

  private key(code: string) {
    return `${this.prefix}room:${code}`;
  }

  async save(snapshot: RoomSnapshot) {
    await this.redis.set(this.key(snapshot.room.code), JSON.stringify(snapshot), "EX", this.ttl);
  }

  async remove(code: string) {
    await this.redis.del(this.key(code));
  }

  async loadAll(): Promise<RoomSnapshot[]> {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await this.redis.scan(cursor, "MATCH", `${this.prefix}room:*`, "COUNT", 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== "0");

    const unique = [...new Set(keys)];
    const out: RoomSnapshot[] = [];
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const values = await this.redis.mget(...chunk);
      values.forEach((raw, idx) => {
        if (!raw) return; // expirou entre o SCAN e o MGET
        try {
          const snap = JSON.parse(raw) as RoomSnapshot;
          if (snap.v !== SNAPSHOT_VERSION || !snap.room?.code) {
            this.log(`[redis] snapshot ignorado (versão ${snap.v}): ${chunk[idx]}`);
            return;
          }
          out.push(snap);
        } catch (e) {
          this.log(`[redis] snapshot inválido ignorado: ${chunk[idx]}`, e);
        }
      });
    }
    return out;
  }
}
