import type { RoomSnapshot, RoomStore } from "./types";

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
