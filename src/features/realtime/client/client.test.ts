import { beforeEach, describe, expect, it } from "vitest";
import type { RoomView } from "../protocol";
import { GameSocket } from "./game-socket";
import { useGameStore } from "./store";

class FakeSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

function setup() {
  const sockets: FakeSocket[] = [];
  const timers: { fn: () => void; ms: number }[] = [];
  const statuses: string[] = [];
  const received: unknown[] = [];
  const gs = new GameSocket({
    url: "ws://x/ws",
    onOpenMessages: () => [{ type: "host:create" }],
    onMessage: (m) => received.push(m),
    onStatus: (s) => statuses.push(s),
    createSocket: () => {
      const s = new FakeSocket();
      sockets.push(s);
      return s;
    },
    setTimer: (fn, ms) => timers.push({ fn, ms }),
    clearTimer: () => {},
  });
  return { gs, sockets, timers, statuses, received };
}

describe("GameSocket", () => {
  it("envia mensagens de retomada ao abrir e entrega mensagens recebidas", () => {
    const { gs, sockets, received, statuses } = setup();
    gs.connect();
    expect(gs.send({ type: "player:start" })).toBe(false); // ainda conectando
    sockets[0].open();
    expect(sockets[0].sent).toEqual([JSON.stringify({ type: "host:create" })]);
    sockets[0].onmessage?.({ data: JSON.stringify({ type: "host:created", code: "ABCD" }) });
    sockets[0].onmessage?.({ data: "lixo" });
    expect(received).toEqual([{ type: "host:created", code: "ABCD" }]);
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("reconecta com backoff exponencial limitado e reenvia a sessão", () => {
    const { gs, sockets, timers } = setup();
    gs.connect();
    sockets[0].open();
    sockets[0].onclose?.();
    expect(timers[0].ms).toBe(500);
    timers[0].fn();
    sockets[1].onclose?.();
    sockets[1].onclose?.();
    expect(timers.map((t) => t.ms)).toEqual([500, 1000, 2000]);
    timers[2].fn();
    sockets[2].open();
    expect(sockets[2].sent).toHaveLength(1);
  });

  it("close() impede nova reconexão", () => {
    const { gs, timers } = setup();
    gs.connect();
    gs.close();
    expect(timers).toHaveLength(0);
  });
});

describe("useGameStore", () => {
  beforeEach(() => useGameStore.getState().reset());

  it("guarda o snapshot e calcula a diferença de relógio", () => {
    const view = { code: "ABCD", serverNow: 10_000 } as RoomView;
    useGameStore.getState().receive({ type: "state", view }, 4_000);
    expect(useGameStore.getState().view?.code).toBe("ABCD");
    expect(useGameStore.getState().clockOffset).toBe(6_000);
  });
  it("registra e limpa erros; guarda código da sala", () => {
    const s = useGameStore.getState();
    s.receive({ type: "error", code: "room_full" });
    expect(useGameStore.getState().error).toBe("room_full");
    s.receive({ type: "host:created", code: "WXYZ" });
    expect(useGameStore.getState().hostCode).toBe("WXYZ");
    s.clearError();
    expect(useGameStore.getState().error).toBeNull();
  });
  it("um novo state limpa erro anterior", () => {
    useGameStore.getState().receive({ type: "error", code: "x" as never });
    useGameStore.getState().receive({ type: "state", view: { serverNow: 1 } as RoomView }, 1);
    expect(useGameStore.getState().error).toBeNull();
  });
});
