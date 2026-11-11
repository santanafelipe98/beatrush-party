import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/features/game";
import { createMockProvider, type MusicProvider } from "@/features/music";
import type { ClientMessage, RoomView, ServerMessage } from "@/features/realtime/protocol";
import { MemoryRoomStore } from "./persistence/memory-stores";
import type { RoomSnapshot } from "./persistence/types";
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
}

type Behavior = (id: string, call: number) => Promise<Track | null>;

/** Catálogo cujas faixas vêm com link "velho"; `getTrack` devolve o que o teste mandar. */
function makeProvider(behavior: Behavior) {
  const calls: string[] = [];
  const getTracksByGenre = vi.fn<MusicProvider["getTracksByGenre"]>(async (genre, limit) =>
    (await createMockProvider().getTracksByGenre(genre, limit)).map((t) => ({ ...t, previewUrl: `old-${t.id}` })),
  );
  const provider: MusicProvider = {
    id: "p",
    getTracksByGenre,
    getTrack: (id) => {
      calls.push(id);
      return behavior(id, calls.length);
    },
  };
  return { provider, calls, getTracksByGenre };
}
const fresh =
  (tag = "fresh"): Behavior =>
  async (id, n) => ({ id, title: "x", artist: "y", previewUrl: `${tag}-${n}-${id}`, coverUrl: `capa-${id}` });

const OPTS = { totalRounds: 3, voteMs: 10_000, roundMs: 10_000, revealMs: 2_000, introMs: 100, rng: () => 0.4 };

describe("link de áudio renovado a cada rodada", () => {
  let store: MemoryRoomStore;
  let managers: RoomManager[];

  const boot = (provider: MusicProvider, extra: Partial<ManagerOptions> = {}) => {
    const m = new RoomManager({ music: provider, store, ...OPTS, ...extra });
    managers.push(m);
    return m;
  };
  const join = (m: RoomManager, code: string, id: string, name: string) => {
    const c = new FakeConn();
    m.handle(c, { type: "player:join", code, playerId: id, name, avatar: 1 });
    return c;
  };
  const send = (m: RoomManager, c: FakeConn, msg: ClientMessage) => m.handle(c, msg);

  /** Sala com TV, Ana e Bob. */
  const lobby = (m: RoomManager) => {
    const tv = new FakeConn();
    m.handle(tv, { type: "host:create" });
    const code = (tv.messages[0] as { code: string }).code;
    return { tv, code, ana: join(m, code, "a", "Ana"), bob: join(m, code, "b", "Bob") };
  };
  /** Do lobby até o início da 1ª rodada. */
  const startGame = async (m: RoomManager, ana: FakeConn, bob: FakeConn) => {
    send(m, ana, { type: "player:start" });
    send(m, ana, { type: "player:vote", genres: ["Pop"] });
    send(m, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(150);
  };
  const crash = async (m: RoomManager) => {
    await m.flush();
    m.dispose();
  };

  beforeEach(() => {
    vi.useFakeTimers();
    store = new MemoryRoomStore();
    managers = [];
  });
  afterEach(() => {
    managers.forEach((m) => m.dispose());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("a TV recebe o link NOVO (não o que veio no sorteio) e a capa atualizada", async () => {
    const { provider, calls } = makeProvider(fresh());
    const m = boot(provider);
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    expect(tv.view.phase).toBe("playing");
    expect(tv.view.round?.previewUrl).toMatch(/^fresh-1-/);
    expect(tv.view.round?.previewUrl).not.toMatch(/^old-/);
    expect(calls).toHaveLength(1);
  });

  it("renova uma vez por rodada, sempre pelo id da faixa daquela rodada", async () => {
    const { provider, calls } = makeProvider(fresh());
    const m = boot(provider);
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    const urls = [tv.view.round!.previewUrl];
    for (let r = 2; r <= 3; r++) {
      send(m, ana, { type: "player:answer", choice: 0 });
      send(m, bob, { type: "player:answer", choice: 1 });
      await vi.advanceTimersByTimeAsync(2_100); // revelação → próxima rodada
      urls.push(tv.view.round!.previewUrl);
      expect(tv.view.round!.index).toBe(r - 1);
    }
    expect(calls).toHaveLength(3);
    expect(new Set(calls).size).toBe(3);
    expect(urls).toEqual([expect.stringMatching(/^fresh-1-/), expect.stringMatching(/^fresh-2-/), expect.stringMatching(/^fresh-3-/)]);
    // e cada link pertence à faixa certa
    urls.forEach((u, i) => expect(u).toContain(calls[i]));
  });

  describe("quando a renovação não dá certo, o jogo segue com o link anterior", () => {
    const cases: [string, Behavior][] = [
      ["erro de rede", async () => Promise.reject(new Error("rede caiu"))],
      ["faixa removida (null)", async () => null],
      ["resposta sem link", async (id) => ({ id, title: "x", artist: "y" })],
    ];
    it.each(cases)("%s", async (_name, behavior) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { provider } = makeProvider(behavior);
      const m = boot(provider);
      const { tv, ana, bob } = lobby(m);
      await startGame(m, ana, bob);
      expect(tv.view.phase).toBe("playing");
      expect(tv.view.round?.previewUrl).toMatch(/^old-/);
      expect(warn.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it("demora demais: usa o link anterior depois do limite e só então começa a rodada", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const { provider } = makeProvider(() => new Promise(() => {}));
      const m = boot(provider, { previewRefreshMs: 1_000 });
      const { tv, ana, bob } = lobby(m);
      send(m, ana, { type: "player:start" });
      send(m, ana, { type: "player:vote", genres: ["Pop"] });
      send(m, bob, { type: "player:vote", genres: ["Pop"] });
      await vi.advanceTimersByTimeAsync(600); // intro (100ms) + metade do limite
      expect(tv.view.phase).toBe("genre-vote"); // ainda esperando a renovação
      await vi.advanceTimersByTimeAsync(600);
      expect(tv.view.phase).toBe("playing");
      expect(tv.view.round?.previewUrl).toMatch(/^old-/);
    });
  });

  it("o tempo de resposta só começa a contar depois da renovação", async () => {
    const slow: Behavior = (id, n) =>
      new Promise((res) => setTimeout(() => res({ id, title: "x", artist: "y", previewUrl: `fresh-${n}` }), 800));
    const { provider } = makeProvider(slow);
    const m = boot(provider);
    const { tv, ana, bob } = lobby(m);
    const t0 = Date.now();
    send(m, ana, { type: "player:start" });
    send(m, ana, { type: "player:vote", genres: ["Pop"] });
    send(m, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(tv.view.phase).toBe("playing");
    // intro 100ms + busca 800ms; a rodada começou depois disso
    expect(tv.view.round!.startedAt).toBeGreaterThanOrEqual(t0 + 900);
    // e o prazo da rodada é contado a partir daí
    expect(m.getRoom(tv.view.code)!.round!.startedAt).toBe(tv.view.round!.startedAt);
  });

  it("provedor sem getTrack (ex.: mock) continua funcionando", async () => {
    const m = boot(createMockProvider());
    const { tv, ana, bob } = lobby(m);
    await startGame(m, ana, bob);
    expect(tv.view.phase).toBe("playing");
    expect(tv.view.round?.previewUrl).toBeUndefined();
  });

  describe("persistência e reinício", () => {
    it("a fila salva no store não carrega links de áudio", async () => {
      const { provider } = makeProvider(fresh());
      const m = boot(provider);
      const { ana, bob } = lobby(m);
      await startGame(m, ana, bob);
      await m.flush();
      const [snap] = await store.loadAll();
      expect(snap.queue.length).toBeGreaterThan(0);
      const json = JSON.stringify(snap.queue);
      expect(json).not.toContain("previewUrl");
      expect(json).not.toContain("old-");
      expect(snap.queue[0].track.title).toBeTruthy(); // o resto da faixa fica
    });

    it("após restaurar, as próximas rodadas usam link novo mesmo com a fila sem links", async () => {
      const a = makeProvider(fresh("antes"));
      const mA = boot(a.provider);
      const { code, ana, bob } = lobby(mA);
      await startGame(mA, ana, bob);
      await crash(mA);

      // outro processo, bem depois: o Deezer devolve links novos
      vi.setSystemTime(Date.now() + 30 * 60_000);
      const b = makeProvider(fresh("depois"));
      const mB = boot(b.provider);
      await mB.restore();
      const tv = new FakeConn();
      mB.handle(tv, { type: "host:attach", code });
      const ana2 = join(mB, code, "a", "Ana");
      const bob2 = join(mB, code, "b", "Bob");
      await vi.advanceTimersByTimeAsync(50); // o prazo da rodada já venceu: encerra na hora
      expect(tv.view.phase).toBe("reveal");
      await vi.advanceTimersByTimeAsync(2_100);
      expect(tv.view.phase).toBe("playing");
      expect(tv.view.round?.previewUrl).toMatch(/^depois-/);
      expect(b.getTracksByGenre).not.toHaveBeenCalled(); // não re-sorteou: usou a fila salva
      void ana2;
      void bob2;
    });

    it("queda no meio da renovação: a faixa continua na fila e a rodada é retomada", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      let hang = false;
      const a = makeProvider((id, n) => (hang ? new Promise(() => {}) : fresh()(id, n)));
      const mA = boot(a.provider, { previewRefreshMs: 60_000 });
      const { tv, code, ana, bob } = lobby(mA);
      await startGame(mA, ana, bob);
      expect(tv.view.round!.index).toBe(0);

      send(mA, ana, { type: "player:answer", choice: 0 });
      send(mA, bob, { type: "player:answer", choice: 1 });
      hang = true; // a próxima renovação trava
      await vi.advanceTimersByTimeAsync(2_100); // revelação acaba → tenta iniciar a rodada 2 → pendurada
      expect(tv.view.phase).toBe("reveal");
      // algo é gravado DURANTE a renovação pendente (ex.: um jogador cai): a fila salva não pode já ter perdido a faixa
      mA.disconnect(bob);
      await crash(mA); // "kill -9" com a renovação pendente

      const [snap] = await store.loadAll();
      expect(snap.queue).toHaveLength(2); // a faixa da rodada 2 NÃO foi consumida

      const b = makeProvider(fresh("retomada"));
      const mB = boot(b.provider);
      await mB.restore();
      const tv2 = new FakeConn();
      mB.handle(tv2, { type: "host:attach", code });
      await vi.advanceTimersByTimeAsync(300);
      expect(tv2.view.phase).toBe("playing");
      expect(tv2.view.round!.index).toBe(1);
      expect(tv2.view.round!.previewUrl).toMatch(/^retomada-/);
    });

    it("snapshot sem prazo mas com fila: inicia a rodada sem sortear de novo", async () => {
      const { provider, getTracksByGenre } = makeProvider(fresh("fila"));
      // monta um snapshot "genre-vote, votação encerrada, fila pronta, sem deadline"
      const seed = boot(provider);
      const { code, ana, bob } = lobby(seed);
      await startGame(seed, ana, bob);
      await seed.flush();
      const [real] = await store.loadAll();
      seed.dispose();
      getTracksByGenre.mockClear();

      const crafted: RoomSnapshot = {
        ...real,
        room: { ...real.room, phase: "genre-vote", round: null, roundsPlayed: 0, voteEndsAt: null },
        deadline: null,
      };
      store.data.set(code, JSON.stringify(crafted));

      const mB = boot(provider);
      await mB.restore();
      const tv = new FakeConn();
      mB.handle(tv, { type: "host:attach", code });
      await vi.advanceTimersByTimeAsync(300);
      expect(tv.view.phase).toBe("playing");
      expect(getTracksByGenre).not.toHaveBeenCalled();
    });
  });
});
