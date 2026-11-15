import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/features/game";
import { createMockProvider, type MusicProvider } from "@/features/music";
import type { ClientMessage, RoomView, ServerMessage } from "@/features/realtime/protocol";
import { MemoryRoomStore } from "./persistence/memory-stores";
import { RoomManager, type Connection, type ManagerOptions } from "./room-manager";

class FakeConn implements Connection {
  messages: ServerMessage[] = [];
  send(m: ServerMessage) {
    this.messages.push(m);
  }
  get view(): RoomView {
    const states = this.messages.filter((m) => m.type === "state");
    return (states[states.length - 1] as { view: RoomView }).view;
  }
  get lastError() {
    return (this.messages.filter((m) => m.type === "error").at(-1) as { code: string } | undefined)?.code;
  }
}

const OPTS = { totalRounds: 3, voteMs: 10_000, roundMs: 10_000, revealMs: 2_000, introMs: 100, rng: () => 0.4 };

/** Faixas com link de áudio, para checar quem recebe o `previewUrl`. */
const withPreview: MusicProvider = {
  id: "p",
  getTracksByGenre: async (genre, limit) =>
    (await createMockProvider().getTracksByGenre(genre, limit)).map((t: Track) => ({ ...t, previewUrl: `audio-${t.id}` })),
};

describe("contagem regressiva no servidor", () => {
  let store: MemoryRoomStore;
  let managers: RoomManager[];

  const boot = (extra: Partial<ManagerOptions> = {}) => {
    const m = new RoomManager({ music: withPreview, store, ...OPTS, ...extra });
    managers.push(m);
    return m;
  };
  const join = (m: RoomManager, code: string, id: string, name: string) => {
    const c = new FakeConn();
    m.handle(c, { type: "player:join", code, playerId: id, name, avatar: 1 });
    return c;
  };
  const send = (m: RoomManager, c: FakeConn, msg: ClientMessage) => m.handle(c, msg);
  const lobby = (m: RoomManager) => {
    const tv = new FakeConn();
    m.handle(tv, { type: "host:create" });
    const code = (tv.messages[0] as { code: string }).code;
    return { tv, code, ana: join(m, code, "a", "Ana"), bob: join(m, code, "b", "Bob") };
  };
  /** Do lobby até a rodada 1 CRIADA (fim da votação + intro), ainda dentro da contagem. */
  const startGame = async (m: RoomManager, ana: FakeConn, bob: FakeConn) => {
    send(m, ana, { type: "player:start" });
    send(m, ana, { type: "player:vote", genres: ["Pop"] });
    send(m, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(150);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryRoomStore();
    managers = [];
  });
  afterEach(() => {
    managers.forEach((m) => m.dispose());
    vi.useRealTimers();
  });

  it("a rodada nasce em contagem: 'valendo' (startedAt) fica 3 s à frente por padrão", async () => {
    const m = new RoomManager({ music: withPreview, store, ...OPTS }); // sem countdownMs: usa o padrão
    managers.push(m);
    const { tv, ana, bob } = lobby(m);
    const t0 = Date.now();
    await startGame(m, ana, bob);
    expect(tv.view.phase).toBe("playing");
    expect(tv.view.round!.countdownMs).toBe(3000);
    // rodada criada após o intro (100 ms): o "valendo" é 3 s depois disso
    expect(tv.view.round!.startedAt).toBeGreaterThanOrEqual(t0 + 100 + 3000);
    expect(tv.view.round!.startedAt).toBeLessThan(t0 + 150 + 3000);
    expect(ana.view.round!.startedAt).toBe(tv.view.round!.startedAt);
  });

  it("countdownMs: 0 desliga a contagem (início imediato, como antes)", async () => {
    const m = boot({ countdownMs: 0 });
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    expect(tv.view.round!.countdownMs).toBe(0);
    expect(tv.view.round!.startedAt).toBeLessThanOrEqual(Date.now());
    send(m, ana, { type: "player:answer", choice: 0 });
    expect(ana.lastError).toBeUndefined();
  });

  it("respostas durante a contagem são recusadas; depois do 'valendo' são aceitas", async () => {
    const m = boot({ countdownMs: 3000 });
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    const go = tv.view.round!.startedAt;

    send(m, ana, { type: "player:answer", choice: 1 });
    expect(ana.lastError).toBe("too_early");
    expect(tv.view.round!.answeredIds).toEqual([]);

    await vi.advanceTimersByTimeAsync(go - Date.now() + 1);
    send(m, ana, { type: "player:answer", choice: 1 });
    expect(tv.view.round!.answeredIds).toEqual(["a"]);
  });

  it("os pontos e o prazo contam a partir do 'valendo', não do início da contagem", async () => {
    const m = boot({ countdownMs: 3000 });
    const { tv, code, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    const go = tv.view.round!.startedAt;
    const correct = m.getRoom(code)!.round!.correctIndex;

    await vi.advanceTimersByTimeAsync(go - Date.now() + 1000); // 1 s depois do "valendo"
    send(m, ana, { type: "player:answer", choice: correct });
    await vi.advanceTimersByTimeAsync(go + 10_000 - Date.now() - 1);
    expect(tv.view.phase).toBe("playing"); // ainda dentro dos 10 s de rodada
    await vi.advanceTimersByTimeAsync(2);
    expect(tv.view.phase).toBe("reveal");
    expect(tv.view.players.find((p) => p.id === "a")!.score).toBe(930); // 1 s de 10 s: igual a sem contagem
  });

  it("a TV recebe o link de áudio já na contagem (para pré-carregar); os celulares nunca", async () => {
    const m = boot({ countdownMs: 3000 });
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    expect(tv.view.round!.previewUrl).toMatch(/^audio-/);
    expect(JSON.stringify(ana.view)).not.toContain("audio-");
    expect(JSON.stringify(bob.view)).not.toContain("previewUrl");
  });

  it("o 'valendo' é marcado DEPOIS de renovar o link da faixa (a busca não come a contagem)", async () => {
    const slow: MusicProvider = {
      ...withPreview,
      getTrack: (id) =>
        new Promise((res) => setTimeout(() => res({ id, title: "x", artist: "y", previewUrl: "novo" }), 800)),
    };
    const m = boot({ music: slow, countdownMs: 3000 });
    const { tv, ana, bob } = lobby(m);
    const t0 = Date.now();
    send(m, ana, { type: "player:start" });
    send(m, ana, { type: "player:vote", genres: ["Pop"] });
    send(m, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(1000);
    expect(tv.view.round!.startedAt).toBeGreaterThanOrEqual(t0 + 100 + 800 + 3000); // intro + busca + contagem
    expect(tv.view.round!.previewUrl).toBe("novo");
  });

  it("todos respondem logo após o 'valendo': encerra antes do tempo, como sempre", async () => {
    const m = boot({ countdownMs: 3000 });
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    await vi.advanceTimersByTimeAsync(tv.view.round!.startedAt - Date.now() + 10);
    send(m, ana, { type: "player:answer", choice: 0 });
    send(m, bob, { type: "player:answer", choice: 1 });
    expect(tv.view.phase).toBe("reveal");
  });

  describe("reinício do servidor durante a contagem", () => {
    it("mantém o 'valendo' e o prazo, e continua recusando respostas antecipadas", async () => {
      const a = boot({ countdownMs: 3000 });
      const { tv, code, ana, bob } = lobby(a);
      await startGame(a, ana, bob);
      const go = tv.view.round!.startedAt;
      await vi.advanceTimersByTimeAsync(1000); // a contagem está no meio
      await a.flush();
      a.dispose();

      const b = boot({ countdownMs: 3000 });
      await b.restore();
      const tv2 = new FakeConn();
      b.handle(tv2, { type: "host:attach", code });
      const ana2 = join(b, code, "a", "Ana");
      const bob2 = join(b, code, "b", "Bob");

      expect(tv2.view.round!.startedAt).toBe(go);
      expect(tv2.view.round!.countdownMs).toBe(3000);
      send(b, ana2, { type: "player:answer", choice: 0 });
      expect(ana2.lastError).toBe("too_early");

      await vi.advanceTimersByTimeAsync(go - Date.now() + 5);
      send(b, ana2, { type: "player:answer", choice: 0 });
      send(b, bob2, { type: "player:answer", choice: 1 });
      expect(tv2.view.phase).toBe("reveal");
    });

    it("sem ninguém responder, a rodada restaurada termina no prazo original (início + contagem + duração)", async () => {
      const a = boot({ countdownMs: 3000 });
      const { tv, code, ana, bob } = lobby(a);
      await startGame(a, ana, bob);
      const go = tv.view.round!.startedAt;
      await a.flush();
      a.dispose();

      const b = boot({ countdownMs: 3000 });
      await b.restore();
      const tv2 = new FakeConn();
      b.handle(tv2, { type: "host:attach", code });
      await vi.advanceTimersByTimeAsync(go + 10_000 - Date.now() - 50);
      expect(tv2.view.phase).toBe("playing");
      await vi.advanceTimersByTimeAsync(100);
      expect(tv2.view.phase).toBe("reveal");
    });

    it("snapshot salvo antes da contagem existir (sem countdownMs) é lido como 'sem contagem'", async () => {
      const a = boot({ countdownMs: 0 });
      const { code, ana, bob } = lobby(a);
      await startGame(a, ana, bob);
      await a.flush();
      a.dispose();
      const raw = JSON.parse(store.data.get(code)!);
      delete raw.room.round.countdownMs; // formato antigo
      store.data.set(code, JSON.stringify(raw));

      const b = boot();
      await b.restore();
      const tv = new FakeConn();
      b.handle(tv, { type: "host:attach", code });
      expect(tv.view.round!.countdownMs).toBe(0);
    });
  });
});
