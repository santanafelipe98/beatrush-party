import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createMockProvider } from "@/features/music";
import type { ServerMessage } from "@/features/realtime/protocol";
import { RoomManager } from "./room-manager";
import { createWsServer } from "./ws-server";

let server: Server;
let manager: RoomManager;
let url: string;

beforeEach(async () => {
  manager = new RoomManager({ music: createMockProvider() });
  server = createServer((_req, res) => res.end("ok"));
  const ws = createWsServer(manager);
  server.on("upgrade", (req, socket, head) => {
    if (!ws.handleUpgrade(req, socket, head)) socket.destroy();
  });
  await new Promise<void>((r) => server.listen(0, r));
  url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  manager.dispose();
  await new Promise((r) => server.close(r));
});

function client(path = "/ws") {
  const ws = new WebSocket(url + path);
  const inbox: ServerMessage[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(d.toString())));
  const opened = new Promise<void>((r, j) => {
    ws.on("open", r);
    ws.on("error", j);
  });
  const waitFor = async (pred: (m: ServerMessage) => boolean) => {
    for (let i = 0; i < 100; i++) {
      const hit = inbox.find(pred);
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error("timeout; inbox=" + JSON.stringify(inbox));
  };
  return { ws, opened, waitFor, inbox, send: (m: unknown) => ws.send(JSON.stringify(m)) };
}

describe("WebSocket server", () => {
  it("TV cria sala e jogador entra via socket real", async () => {
    const tv = client();
    await tv.opened;
    tv.send({ type: "host:create" });
    const created = (await tv.waitFor((m) => m.type === "host:created")) as { code: string };

    const p = client();
    await p.opened;
    p.send({ type: "player:join", code: created.code, playerId: "p1", name: "Ana", avatar: 3 });
    const st = await tv.waitFor((m) => m.type === "state" && m.view.players.length === 1);
    expect(st).toMatchObject({ view: { players: [{ name: "Ana", avatar: 3 }] } });

    p.ws.close();
    await tv.waitFor((m) => m.type === "state" && m.view.players.length === 0);
    tv.ws.close();
  });

  it("mensagens inválidas retornam bad_message", async () => {
    const c = client();
    await c.opened;
    c.ws.send("não é json");
    c.send({ type: "player:answer", choice: 99 });
    await c.waitFor((m) => m.type === "error" && m.code === "bad_message");
    expect(c.inbox.filter((m) => m.type === "error")).toHaveLength(2);
    c.ws.close();
  });

  it("rejeita upgrade em caminhos que não são /ws", async () => {
    const c = client("/outro");
    await expect(c.opened).rejects.toBeDefined();
  });
});
