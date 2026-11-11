import { describe, expect, it, vi } from "vitest";
import { createRoom, type Track } from "@/features/game";
import type { MusicProvider } from "@/features/music";
import {
  MemoryRoomStore,
  MemoryTrackCache,
  RedisRoomStore,
  RedisTrackCache,
  SNAPSHOT_VERSION,
  createPersistence,
  withTrackCache,
  type RedisLike,
  type RoomSnapshot,
  type RoomStore,
  type TrackCache,
} from "./index";

/** Redis falso em memória: suficiente para exercitar SCAN paginado, MGET, EX e DEL. */
class FakeRedis implements RedisLike {
  data = new Map<string, string>();
  ttls = new Map<string, number>();
  fail = false;
  async get(key: string) {
    this.check();
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string, _mode: "EX", seconds: number) {
    this.check();
    this.data.set(key, value);
    this.ttls.set(key, seconds);
  }
  async del(...keys: string[]) {
    this.check();
    keys.forEach((k) => this.data.delete(k));
  }
  async mget(...keys: string[]) {
    this.check();
    return keys.map((k) => this.data.get(k) ?? null);
  }
  /** Páginas de 2 chaves, para provar que o cursor é seguido até "0". */
  async scan(cursor: string, _m: "MATCH", pattern: string): Promise<[string, string[]]> {
    this.check();
    const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    const all = [...this.data.keys()].filter((k) => re.test(k));
    const start = Number(cursor);
    const next = start + 2;
    return [next >= all.length ? "0" : String(next), all.slice(start, next)];
  }
  private check() {
    if (this.fail) throw new Error("Redis indisponível");
  }
}

const snapshot = (code: string, extra: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  v: SNAPSHOT_VERSION,
  room: createRoom(code, 4),
  queue: [],
  deadline: null,
  savedAt: 1000,
  ...extra,
});

describe.each<[string, () => RoomStore]>([
  ["MemoryRoomStore", () => new MemoryRoomStore()],
  ["RedisRoomStore (cliente falso)", () => new RedisRoomStore(new FakeRedis())],
])("contrato de RoomStore: %s", (_name, make) => {
  it("salva, lista tudo e remove", async () => {
    const store = make();
    for (const code of ["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"]) await store.save(snapshot(code));
    const all = await store.loadAll();
    expect(all.map((s) => s.room.code).sort()).toEqual(["AAAA", "BBBB", "CCCC", "DDDD", "EEEE"]);

    await store.remove("CCCC");
    expect((await store.loadAll()).map((s) => s.room.code)).not.toContain("CCCC");
    await store.remove("ZZZZ"); // remover inexistente não falha
  });

  it("gravar de novo substitui o snapshot e preserva o prazo e a fila", async () => {
    const store = make();
    await store.save(snapshot("AAAA"));
    const track: Track = { id: "t1", title: "T", artist: "A", previewUrl: "http://x/1.mp3" };
    await store.save(
      snapshot("AAAA", { deadline: { action: "endRound", at: 5000 }, queue: [{ track, distractors: [] }] }),
    );
    const [only] = await store.loadAll();
    expect(only.deadline).toEqual({ action: "endRound", at: 5000 });
    expect(only.queue[0].track.previewUrl).toBe("http://x/1.mp3");
  });
});

describe("RedisRoomStore", () => {
  it("usa prefixo, TTL renovável e ignora lixo e versões antigas", async () => {
    const redis = new FakeRedis();
    const log = vi.fn();
    const store = new RedisRoomStore(redis, { prefix: "t:", roomTtlSeconds: 60, log });
    await store.save(snapshot("AAAA"));
    expect([...redis.data.keys()]).toEqual(["t:room:AAAA"]);
    expect(redis.ttls.get("t:room:AAAA")).toBe(60);

    redis.data.set("t:room:OLD1", JSON.stringify({ ...snapshot("OLD1"), v: SNAPSHOT_VERSION - 1 }));
    redis.data.set("t:room:BAD1", "{não é json");
    redis.data.set("outro:room:ZZZZ", JSON.stringify(snapshot("ZZZZ"))); // outro app/prefixo
    expect((await store.loadAll()).map((s) => s.room.code)).toEqual(["AAAA"]);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("propaga erro do Redis (quem chama decide degradar)", async () => {
    const redis = new FakeRedis();
    const store = new RedisRoomStore(redis);
    redis.fail = true;
    await expect(store.save(snapshot("AAAA"))).rejects.toThrow("indisponível");
  });
});

describe.each<[string, () => TrackCache]>([
  ["MemoryTrackCache", () => new MemoryTrackCache()],
  ["RedisTrackCache (cliente falso)", () => new RedisTrackCache(new FakeRedis())],
])("contrato de TrackCache: %s", (_name, make) => {
  it("guarda e devolve JSON; chave ausente é null", async () => {
    const cache = make();
    expect(await cache.get("x")).toBeNull();
    await cache.set("x", { a: [1, 2] }, 60);
    expect(await cache.get("x")).toEqual({ a: [1, 2] });
  });
});

describe("MemoryTrackCache", () => {
  it("expira pelo relógio", async () => {
    let now = 0;
    const cache = new MemoryTrackCache(() => now);
    await cache.set("k", "v", 10);
    now = 9_999;
    expect(await cache.get("k")).toBe("v");
    now = 10_000;
    expect(await cache.get("k")).toBeNull();
  });
});

describe("withTrackCache", () => {
  const tracks: Track[] = [{ id: "1", title: "A", artist: "X" }];
  const provider = (impl: MusicProvider["getTracksByGenre"]): MusicProvider => ({ id: "p", getTracksByGenre: vi.fn(impl) });

  it("consulta o provedor uma vez e serve o resto do cache", async () => {
    const p = provider(async () => tracks);
    const cached = withTrackCache(p, new MemoryTrackCache());
    expect(await cached.getTracksByGenre("Pop", 5)).toEqual(tracks);
    expect(await cached.getTracksByGenre("Pop", 5)).toEqual(tracks);
    expect(p.getTracksByGenre).toHaveBeenCalledTimes(1);
    await cached.getTracksByGenre("Rock", 5); // outro gênero = outra chave
    await cached.getTracksByGenre("Pop", 9); // outro limite = outra chave
    expect(p.getTracksByGenre).toHaveBeenCalledTimes(3);
    expect(cached.id).toBe("p");
  });

  it("não guarda resultado vazio e usa TTL curto por padrão (links do Deezer expiram)", async () => {
    const cache = { get: vi.fn(async () => null), set: vi.fn(async () => {}) };
    await withTrackCache(provider(async () => []), cache).getTracksByGenre("Pop", 5);
    expect(cache.set).not.toHaveBeenCalled();
    await withTrackCache(provider(async () => tracks), cache).getTracksByGenre("Pop", 5);
    const ttl = (cache.set.mock.calls[0] as unknown[])[2] as number;
    expect(ttl).toBeLessThan(14 * 60);
  });

  it("falha do cache nunca derruba a busca", async () => {
    const broken: TrackCache = {
      get: async () => {
        throw new Error("get");
      },
      set: async () => {
        throw new Error("set");
      },
    };
    const log = vi.fn();
    const out = await withTrackCache(provider(async () => tracks), broken, 60, log).getTracksByGenre("Pop", 5);
    expect(out).toEqual(tracks);
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("falha do provedor continua sendo propagada", async () => {
    const cached = withTrackCache(
      provider(async () => {
        throw new Error("deezer fora");
      }),
      new MemoryTrackCache(),
    );
    await expect(cached.getTracksByGenre("Pop", 5)).rejects.toThrow("deezer fora");
  });
});

describe("createPersistence", () => {
  it("sem REDIS_URL usa memória (comportamento anterior)", async () => {
    const p = await createPersistence({});
    expect(p.kind).toBe("memory");
    await p.roomStore.save(snapshot("AAAA"));
    expect(await p.roomStore.loadAll()).toEqual([]); // nada é persistido
    await p.close();
  });

  it("com REDIS_URL inacessível falha na subida, com mensagem clara", async () => {
    await expect(createPersistence({ REDIS_URL: "redis://127.0.0.1:1" })).rejects.toThrow(/Redis não respondeu/);
  });
});

// Integração com um Redis de verdade: roda só quando REDIS_URL está definido (ex.: `docker compose up -d redis`).
describe.skipIf(!process.env.REDIS_URL)("Redis real", () => {
  it("salva, restaura e remove salas e cache", async () => {
    const prefix = `beatrush-test-${Date.now()}:`;
    const p = await createPersistence({ REDIS_URL: process.env.REDIS_URL, REDIS_PREFIX: prefix });
    try {
      expect(p.kind).toBe("redis");
      await p.roomStore.save(snapshot("REAL"));
      await p.roomStore.save(snapshot("REL2", { deadline: { action: "endVote", at: 9 } }));
      const all = await p.roomStore.loadAll();
      expect(all.map((s) => s.room.code).sort()).toEqual(["REAL", "REL2"]);
      await p.roomStore.remove("REAL");
      await p.roomStore.remove("REL2");
      expect(await p.roomStore.loadAll()).toEqual([]);

      await p.trackCache.set("k", { ok: true }, 5);
      expect(await p.trackCache.get("k")).toEqual({ ok: true });
    } finally {
      await p.close();
    }
  });
});
