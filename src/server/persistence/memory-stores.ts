import type { RoomSnapshot, RoomStore, TrackCache } from "./types";

/** Padrão quando não há Redis: nada é persistido (comportamento anterior). */
export class NullRoomStore implements RoomStore {
  async save() {}
  async remove() {}
  async loadAll() {
    return [];
  }
}

/**
 * Guarda os snapshots em memória, passando por JSON como o Redis faria
 * (pega valores não serializáveis e evita aliasing). Útil em testes.
 */
export class MemoryRoomStore implements RoomStore {
  readonly data = new Map<string, string>();
  async save(s: RoomSnapshot) {
    this.data.set(s.room.code, JSON.stringify(s));
  }
  async remove(code: string) {
    this.data.delete(code);
  }
  async loadAll() {
    return [...this.data.values()].map((v) => JSON.parse(v) as RoomSnapshot);
  }
}

/** Cache em memória com expiração (usado quando não há Redis). */
export class MemoryTrackCache implements TrackCache {
  private entries = new Map<string, { value: string; expiresAt: number }>();
  constructor(private now: () => number = () => Date.now()) {}

  async get<T>(key: string): Promise<T | null> {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return JSON.parse(hit.value) as T;
  }
  async set(key: string, value: unknown, ttlSeconds: number) {
    this.entries.set(key, { value: JSON.stringify(value), expiresAt: this.now() + ttlSeconds * 1000 });
  }
}
