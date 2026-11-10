import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockProvider } from "@/features/music";
import type { ClientMessage, RoomView, ServerMessage } from "@/features/realtime/protocol";
import { RoomManager, type Connection } from "./room-manager";

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
    const errs = this.messages.filter((m) => m.type === "error");
    return (errs[errs.length - 1] as { code: string } | undefined)?.code;
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("RoomManager", () => {
  let mgr: RoomManager;
  let tv: FakeConn, ana: FakeConn, bob: FakeConn;
  let code: string;
  const send = (c: FakeConn, m: ClientMessage) => mgr.handle(c, m);

  beforeEach(async () => {
    vi.useFakeTimers();
    mgr = new RoomManager({
      music: createMockProvider(),
      totalRounds: 2,
      voteMs: 1000,
      roundMs: 1000,
      revealMs: 500,
      introMs: 100,
      rng: () => 0.4,
    });
    tv = new FakeConn();
    ana = new FakeConn();
    bob = new FakeConn();
    send(tv, { type: "host:create" });
    code = (tv.messages[0] as { code: string }).code;
    send(ana, { type: "player:join", code, playerId: "a", name: "Ana", avatar: 1 });
    send(bob, { type: "player:join", code, playerId: "b", name: "Bob", avatar: 2 });
  });
  afterEach(() => {
    mgr.dispose();
    vi.useRealTimers();
  });

  it("cria sala com código de 4 letras e atualiza o lobby em tempo real", () => {
    expect(code).toMatch(/^[A-Z]{4}$/);
    expect(tv.view.players.map((p) => p.name)).toEqual(["Ana", "Bob"]);
    expect(ana.view.you?.playerId).toBe("a");
  });

  it("erros de domínio chegam ao remetente", () => {
    send(bob, { type: "player:start" });
    expect(bob.lastError).toBe("not_host");
    send(new FakeConn(), { type: "player:join", code: "ZZZZ", playerId: "x", name: "X", avatar: 0 });
  });

  it("sala inexistente e ação sem entrar", () => {
    const c = new FakeConn();
    send(c, { type: "player:join", code: "ZZZZ", playerId: "x", name: "X", avatar: 0 });
    expect(c.lastError).toBe("room_not_found");
    send(c, { type: "player:start" });
    expect(c.lastError).toBe("not_joined");
  });

  it("joga uma partida completa e nunca vaza a resposta antes da revelação", async () => {
    send(ana, { type: "player:start" });
    expect(tv.view.phase).toBe("genre-vote");
    send(ana, { type: "player:vote", genres: ["Pop", "Funk"] });
    send(bob, { type: "player:vote", genres: ["Funk"] });
    await flush();
    expect(tv.view.topGenres[0]).toBe("Funk");

    await vi.advanceTimersByTimeAsync(100);
    expect(tv.view.phase).toBe("playing");
    expect(JSON.stringify(ana.view)).not.toContain("correctIndex");
    expect(tv.view.round?.reveal).toBeUndefined();

    // acerta com Ana usando o estado interno; Bob não responde
    const correct = mgr.getRoom(code)!.round!.correctIndex;
    send(ana, { type: "player:answer", choice: correct });
    expect(ana.view.you?.answer).toBe(correct);
    expect(tv.view.round?.answeredIds).toEqual(["a"]);

    await vi.advanceTimersByTimeAsync(1000); // fim do tempo
    expect(tv.view.phase).toBe("reveal");
    expect(tv.view.round?.reveal?.correctIndex).toBe(correct);
    expect(tv.view.players.find((p) => p.id === "a")!.score).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(500); // próxima rodada
    expect(tv.view.phase).toBe("playing");
    expect(tv.view.roundsPlayed).toBe(1);

    // todos respondem -> encerra antecipadamente
    send(ana, { type: "player:answer", choice: 0 });
    send(bob, { type: "player:answer", choice: 1 });
    expect(tv.view.phase).toBe("reveal");

    await vi.advanceTimersByTimeAsync(500);
    expect(tv.view.phase).toBe("finished");

    // revanche por maioria volta ao lobby
    send(ana, { type: "player:replay" });
    send(bob, { type: "player:replay" });
    expect(tv.view.phase).toBe("lobby");
    expect(tv.view.players.every((p) => p.score === 0)).toBe(true);
  });

  it("player não recebe previewUrl; Host recebe", async () => {
    send(ana, { type: "player:start" });
    send(ana, { type: "player:vote", genres: ["Pop"] });
    send(bob, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);
    expect(ana.view.round).not.toHaveProperty("previewUrl");
  });

  it("desconexão no lobby libera a vaga; durante o jogo marca offline e permite reconectar", async () => {
    mgr.disconnect(bob);
    expect(tv.view.players.map((p) => p.id)).toEqual(["a"]);

    const bob2 = new FakeConn();
    send(bob2, { type: "player:join", code, playerId: "b", name: "Bob", avatar: 2 });
    send(ana, { type: "player:start" });
    send(ana, { type: "player:vote", genres: ["Pop"] });
    send(bob2, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(200);

    mgr.disconnect(bob2);
    expect(tv.view.players.find((p) => p.id === "b")!.connected).toBe(false);
    // Ana é a única conectada: responder já encerra a rodada
    send(ana, { type: "player:answer", choice: 0 });
    expect(tv.view.phase).toBe("reveal");

    const bob3 = new FakeConn();
    send(bob3, { type: "player:join", code, playerId: "b", name: "Bob", avatar: 2 });
    expect(tv.view.players.find((p) => p.id === "b")!.connected).toBe(true);
  });

  it("TV pode reanexar à sala existente", () => {
    const tv2 = new FakeConn();
    send(tv2, { type: "host:attach", code: code.toLowerCase() });
    expect(tv2.view.code).toBe(code);
    send(tv2, { type: "host:attach", code: "ZZZZ" });
    expect(tv2.lastError).toBe("room_not_found");
  });

  it("usa o provedor de fallback quando o principal falha", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = new RoomManager({
      music: { id: "broken", getTracksByGenre: async () => Promise.reject(new Error("x")) },
      fallbackMusic: createMockProvider(),
      totalRounds: 2,
      introMs: 10,
      rng: () => 0.4,
    });
    const t = new FakeConn(), a = new FakeConn(), b = new FakeConn();
    m.handle(t, { type: "host:create" });
    const c = (t.messages[0] as { code: string }).code;
    m.handle(a, { type: "player:join", code: c, playerId: "a", name: "A", avatar: 0 });
    m.handle(b, { type: "player:join", code: c, playerId: "b", name: "B", avatar: 0 });
    m.handle(a, { type: "player:start" });
    m.handle(a, { type: "player:vote", genres: ["Pop"] });
    m.handle(b, { type: "player:vote", genres: ["Pop"] });
    await vi.advanceTimersByTimeAsync(50);
    expect(t.view.phase).toBe("playing");
    m.dispose();
    err.mockRestore();
  });
});
