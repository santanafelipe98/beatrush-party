import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicProvider } from "@/features/music";
import { createMockProvider } from "@/features/music";
import type { ClientMessage, RoomView, ServerMessage } from "@/features/realtime/protocol";
import { MemoryRoomStore } from "./persistence/memory-stores";
import type { RoomStore } from "./persistence/types";
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

describe("reinício do servidor (restauração a partir do store)", () => {
  let store: MemoryRoomStore;
  let managers: RoomManager[];

  const boot = (extra: Partial<ManagerOptions> = {}) => {
    const m = new RoomManager({ music: createMockProvider(), store, ...OPTS, ...extra });
    managers.push(m);
    return m;
  };
  /** Simula `kill` do processo: garante a última gravação e descarta a instância (sem apagar o store). */
  const crash = async (m: RoomManager) => {
    await m.flush();
    m.dispose();
  };
  const join = (m: RoomManager, code: string, id: string, name: string) => {
    const c = new FakeConn();
    m.handle(c, { type: "player:join", code, playerId: id, name, avatar: 1 });
    return c;
  };
  const tv = (m: RoomManager, code: string) => {
    const c = new FakeConn();
    m.handle(c, { type: "host:attach", code });
    return c;
  };
  const send = (m: RoomManager, c: FakeConn, msg: ClientMessage) => m.handle(c, msg);

  /** Cria sala com Ana (host) e Bob. */
  const lobby = (m: RoomManager) => {
    const display = new FakeConn();
    m.handle(display, { type: "host:create" });
    const code = (display.messages[0] as { code: string }).code;
    const ana = join(m, code, "a", "Ana");
    const bob = join(m, code, "b", "Bob");
    return { code, display, ana, bob };
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

  it("grava a sala no store ao criar e a cada mudança", async () => {
    const m = boot();
    const { code } = lobby(m);
    await m.flush();
    const [snap] = await store.loadAll();
    expect(snap.room.code).toBe(code);
    expect(snap.room.players.map((p) => p.name)).toEqual(["Ana", "Bob"]);
  });

  it("sem store configurado nada quebra (padrão sem persistência)", async () => {
    const m = new RoomManager({ music: createMockProvider(), ...OPTS });
    managers.push(m);
    lobby(m);
    await m.flush();
    expect(await m.restore()).toBe(0);
  });

  it("lobby: a sala e os jogadores voltam; TV e celulares reconectam", async () => {
    const a = boot();
    const { code } = lobby(a);
    await crash(a);

    const b = boot();
    expect(await b.restore()).toBe(1);
    expect(b.getRoom(code)?.players.every((p) => !p.connected)).toBe(true); // ninguém conectado ainda

    const display = tv(b, code);
    expect(display.view.players.map((p) => p.name)).toEqual(["Ana", "Bob"]);
    const ana = join(b, code, "a", "Ana");
    expect(ana.view.hostPlayerId).toBe("a"); // continua sendo o host
    expect(display.view.players.find((p) => p.id === "a")?.connected).toBe(true);
    expect(display.view.players.find((p) => p.id === "b")?.connected).toBe(false);
  });

  it("durante a votação: mantém os votos e rearma o timer pelo tempo que faltava", async () => {
    const a = boot();
    const { code, ana } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Funk"] });
    await vi.advanceTimersByTimeAsync(4_000); // faltam 6s dos 10s
    await crash(a);

    const b = boot();
    await b.restore();
    const display = tv(b, code);
    const ana2 = join(b, code, "a", "Ana");
    expect(display.view.phase).toBe("genre-vote");
    expect(ana2.view.you?.votes).toEqual(["Funk"]); // voto de antes do reinício

    await vi.advanceTimersByTimeAsync(5_000); // ainda não deu o prazo
    expect(display.view.phase).toBe("genre-vote");
    await vi.advanceTimersByTimeAsync(1_200); // venceu o prazo + intro
    expect(display.view.phase).toBe("playing");
    expect(display.view.topGenres[0]).toBe("Funk");
  });

  it("durante a rodada: preserva respostas e termina no prazo original", async () => {
    const a = boot();
    const { code, ana, bob } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Pop"] });
    send(a, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);
    const correct = a.getRoom(code)!.round!.correctIndex;
    send(a, ana, { type: "player:answer", choice: correct });
    await vi.advanceTimersByTimeAsync(3_000); // faltam 7s
    await crash(a);

    const b = boot();
    await b.restore();
    const display = tv(b, code);
    const ana2 = join(b, code, "a", "Ana");
    const bob2 = join(b, code, "b", "Bob");
    expect(display.view.phase).toBe("playing");
    expect(display.view.round?.answeredIds).toEqual(["a"]);
    expect(ana2.view.you?.answer).toBe(correct);

    // Bob responde após o reinício → todos responderam → revelação imediata
    send(b, bob2, { type: "player:answer", choice: 0 });
    expect(display.view.phase).toBe("reveal");
    expect(display.view.players.find((p) => p.id === "a")!.score).toBeGreaterThan(0);
  });

  it("durante a rodada, sem ninguém responder: o timer rearmado encerra no prazo", async () => {
    const a = boot();
    const { code, ana, bob } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Pop"] });
    send(a, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(6_000); // faltam 4s
    await crash(a);

    const b = boot();
    await b.restore();
    const display = tv(b, code);
    join(b, code, "a", "Ana");
    join(b, code, "b", "Bob");
    await vi.advanceTimersByTimeAsync(3_000);
    expect(display.view.phase).toBe("playing");
    await vi.advanceTimersByTimeAsync(1_100);
    expect(display.view.phase).toBe("reveal");
  });

  it("durante a revelação: segue para a próxima rodada e depois ao fim do jogo", async () => {
    const a = boot({ totalRounds: 1 });
    const { code, ana, bob } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Pop"] });
    send(a, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);
    send(a, ana, { type: "player:answer", choice: 0 });
    send(a, bob, { type: "player:answer", choice: 1 });
    expect(a.getRoom(code)!.phase).toBe("reveal");
    await crash(a);

    const b = boot({ totalRounds: 1 });
    await b.restore();
    const display = tv(b, code);
    expect(display.view.phase).toBe("reveal");
    await vi.advanceTimersByTimeAsync(2_100);
    expect(display.view.phase).toBe("finished");
  });

  it("jogo terminado: restaura o placar e permite revanche", async () => {
    const a = boot({ totalRounds: 1 });
    const { code, ana, bob } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Pop"] });
    send(a, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);
    send(a, ana, { type: "player:answer", choice: a.getRoom(code)!.round!.correctIndex });
    send(a, bob, { type: "player:answer", choice: 3 });
    await vi.advanceTimersByTimeAsync(2_100);
    expect(a.getRoom(code)!.phase).toBe("finished");
    const scoreBefore = a.getRoom(code)!.players.find((p) => p.id === "a")!.score;
    await crash(a);

    const b = boot({ totalRounds: 1 });
    await b.restore();
    const display = tv(b, code);
    const ana2 = join(b, code, "a", "Ana");
    const bob2 = join(b, code, "b", "Bob");
    expect(display.view.phase).toBe("finished");
    expect(display.view.players.find((p) => p.id === "a")!.score).toBe(scoreBefore);
    send(b, ana2, { type: "player:replay" });
    send(b, bob2, { type: "player:replay" });
    expect(display.view.phase).toBe("lobby");
  });

  it("reinício enquanto as músicas carregavam: retoma o carregamento e inicia a partida", async () => {
    const never: MusicProvider = { id: "lento", getTracksByGenre: () => new Promise(() => {}) };
    const a = boot({ music: never });
    const { code, ana, bob } = lobby(a);
    send(a, ana, { type: "player:start" });
    send(a, ana, { type: "player:vote", genres: ["Pop"] });
    send(a, bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(50);
    // votação encerrada, mas nenhuma música chegou: sem prazo salvo
    const [snap] = await (async () => {
      await a.flush();
      return store.loadAll();
    })();
    expect(snap.room.voteEndsAt).toBeNull();
    expect(snap.deadline).toBeNull();
    expect(snap.queue).toEqual([]);
    await crash(a);

    const b = boot(); // agora com o catálogo funcionando
    await b.restore();
    const display = tv(b, code);
    await vi.advanceTimersByTimeAsync(300);
    expect(display.view.phase).toBe("playing");
  });

  it("jogadores restaurados continuam sem poder duplicar nome nem ocupar vaga extra", async () => {
    const a = boot();
    const { code } = lobby(a);
    await crash(a);
    const b = boot();
    await b.restore();
    const intruso = join(b, code, "x", "Ana"); // nome já usado por quem está offline
    expect(intruso.lastError).toBe("name_taken");
    const voltou = join(b, code, "a", "Ana");
    expect(voltou.lastError).toBeUndefined();
  });

  it("restaurar duas vezes não duplica salas", async () => {
    const a = boot();
    lobby(a);
    await crash(a);
    const b = boot();
    expect(await b.restore()).toBe(1);
    expect(await b.restore()).toBe(0);
  });

  describe("salas abandonadas", () => {
    it("são removidas da memória e do store após o tempo ocioso", async () => {
      const m = boot({ idleMs: 60_000 });
      const { code, display, ana, bob } = lobby(m);
      m.disconnect(ana);
      m.disconnect(bob);
      m.disconnect(display);
      await vi.advanceTimersByTimeAsync(59_000);
      expect(m.getRoom(code)).toBeDefined();
      await vi.advanceTimersByTimeAsync(2_000);
      await m.flush();
      expect(m.getRoom(code)).toBeUndefined();
      expect(await store.loadAll()).toEqual([]);
    });

    it("reconectar a tempo cancela a remoção", async () => {
      const m = boot({ idleMs: 60_000 });
      const { code, display } = lobby(m);
      m.disconnect(display);
      const back = tv(m, code);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(m.getRoom(code)).toBeDefined();
      expect(back.view.code).toBe(code);
    });

    it("sala restaurada que ninguém reabre também é limpa", async () => {
      const a = boot();
      const { code } = lobby(a);
      await crash(a);
      const b = boot({ idleMs: 30_000 });
      await b.restore();
      await vi.advanceTimersByTimeAsync(31_000);
      await b.flush();
      expect(b.getRoom(code)).toBeUndefined();
      expect(await store.loadAll()).toEqual([]);
    });
  });

  describe("falhas do store", () => {
    it("o jogo continua em memória e avisa uma vez", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const broken: RoomStore = {
        save: async () => {
          throw new Error("Redis caiu");
        },
        remove: async () => {},
        loadAll: async () => [],
      };
      const m = boot({ store: broken });
      const { code, ana, bob } = lobby(m);
      send(m, ana, { type: "player:start" });
      send(m, ana, { type: "player:vote", genres: ["Pop"] });
      send(m, bob, { type: "player:vote", genres: ["Pop"] });
      await vi.advanceTimersByTimeAsync(200);
      await m.flush();
      expect(m.getRoom(code)!.phase).toBe("playing");
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][1])).toContain("Redis caiu");
    });

    it("gravações saem em ordem: o estado final é o que fica salvo", async () => {
      const m = boot();
      const { code, ana, bob } = lobby(m);
      send(m, ana, { type: "player:start" });
      send(m, ana, { type: "player:vote", genres: ["Pop"] });
      send(m, bob, { type: "player:vote", genres: ["Rock"] });
      await vi.advanceTimersByTimeAsync(200);
      await m.flush();
      const [snap] = await store.loadAll();
      expect(snap.room.phase).toBe(m.getRoom(code)!.phase);
      expect(snap.room.votes).toEqual({ a: ["Pop"], b: ["Rock"] });
      expect(snap.deadline?.action).toBe("endRound");
    });
  });
});
