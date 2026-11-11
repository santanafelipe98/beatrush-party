import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createMockProvider } from "@/features/music";
import type { RoomView, ServerMessage } from "@/features/realtime/protocol";
import { createPersistence, type Persistence } from "./persistence";
import { RoomManager } from "./room-manager";
import { createWsServer } from "./ws-server";

/**
 * Integração de ponta a ponta com Redis REAL e WebSocket REAL: sobe "o servidor", joga um pouco,
 * derruba, sobe outro e confere que a sala volta. Só roda com REDIS_URL definido
 * (ex.: `docker compose up -d redis` + `REDIS_URL=redis://localhost:6379 npm test`).
 */
describe.skipIf(!process.env.REDIS_URL)("reinício com Redis e WebSocket reais", () => {
  const prefix = `beatrush-it-${Date.now()}:`;
  const open: { close(): Promise<void> }[] = [];

  afterEach(async () => {
    for (const c of open.splice(0).reverse()) await c.close();
  });

  async function bootServer() {
    const persistence: Persistence = await createPersistence({ REDIS_URL: process.env.REDIS_URL, REDIS_PREFIX: prefix });
    const manager = new RoomManager({
      music: createMockProvider(),
      store: persistence.roomStore,
      totalRounds: 2,
      voteMs: 60_000,
      roundMs: 60_000,
      revealMs: 60_000,
      introMs: 50,
    });
    const restored = await manager.restore();
    const server: Server = createServer();
    const ws = createWsServer(manager);
    server.on("upgrade", (req, socket, head) => void ws.handleUpgrade(req, socket, head));
    await new Promise<void>((r) => server.listen(0, r));
    const url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}/ws`;

    const sockets = new Set<WebSocket>();
    const stop = async () => {
      sockets.forEach((s) => s.terminate());
      await manager.flush(); // desligamento limpo: espera as gravações
      manager.dispose();
      await new Promise((r) => server.close(r));
      await persistence.close();
    };
    open.push({ close: stop });

    function client() {
      const sock = new WebSocket(url);
      sockets.add(sock);
      const inbox: ServerMessage[] = [];
      sock.on("message", (d) => inbox.push(JSON.parse(d.toString())));
      const ready = new Promise<void>((r) => sock.on("open", () => r()));
      const view = async (pred: (v: RoomView) => boolean = () => true) => {
        for (let i = 0; i < 200; i++) {
          const states = inbox.filter((m) => m.type === "state") as { view: RoomView }[];
          const hit = states.map((s) => s.view).reverse().find(pred);
          if (hit) return hit;
          await new Promise((r) => setTimeout(r, 10));
        }
        throw new Error("timeout; inbox=" + JSON.stringify(inbox.slice(-3)));
      };
      return { sock, ready, inbox, view, send: (m: unknown) => sock.send(JSON.stringify(m)) };
    }
    return { manager, restored, client, stop, persistence };
  }

  it("a sala, os votos e o placar sobrevivem à troca de servidor", async () => {
    // ---- servidor 1 ----
    const s1 = await bootServer();
    const tv1 = s1.client();
    await tv1.ready;
    tv1.send({ type: "host:create" });
    const code = ((await new Promise<ServerMessage>((res) => {
      const t = setInterval(() => {
        const m = tv1.inbox.find((x) => x.type === "host:created");
        if (m) {
          clearInterval(t);
          res(m);
        }
      }, 10);
    })) as { code: string }).code;

    const ana = s1.client();
    const bob = s1.client();
    await Promise.all([ana.ready, bob.ready]);
    ana.send({ type: "player:join", code, playerId: "a", name: "Ana", avatar: 1 });
    bob.send({ type: "player:join", code, playerId: "b", name: "Bob", avatar: 2 });
    await tv1.view((v) => v.players.length === 2);
    ana.send({ type: "player:start" });
    await ana.view((v) => v.phase === "genre-vote");
    ana.send({ type: "player:vote", genres: ["Funk"] });
    await ana.view((v) => v.you?.votes?.[0] === "Funk");

    await s1.stop(); // "derruba o servidor"

    // ---- servidor 2 (processo novo, memória vazia, mesmo Redis) ----
    const s2 = await bootServer();
    expect(s2.restored).toBeGreaterThanOrEqual(1);
    expect(s2.manager.getRoom(code)?.phase).toBe("genre-vote");

    const tv2 = s2.client();
    await tv2.ready;
    tv2.send({ type: "host:attach", code });
    const restoredView = await tv2.view();
    expect(restoredView.phase).toBe("genre-vote");
    expect(restoredView.players.map((p) => p.name)).toEqual(["Ana", "Bob"]);
    expect(restoredView.votedIds).toEqual(["a"]);

    // os celulares reconectam com o mesmo playerId e recuperam o próprio estado
    const ana2 = s2.client();
    const bob2 = s2.client();
    await Promise.all([ana2.ready, bob2.ready]);
    ana2.send({ type: "player:join", code, playerId: "a", name: "Ana", avatar: 1 });
    bob2.send({ type: "player:join", code, playerId: "b", name: "Bob", avatar: 2 });
    expect((await ana2.view((v) => !!v.you)).you?.votes).toEqual(["Funk"]);

    // e a partida segue normalmente no servidor novo
    bob2.send({ type: "player:vote", genres: ["Funk"] });
    const playing = await tv2.view((v) => v.phase === "playing");
    expect(playing.topGenres[0]).toBe("Funk");
    ana2.send({ type: "player:answer", choice: 0 });
    bob2.send({ type: "player:answer", choice: 1 });
    await tv2.view((v) => v.phase === "reveal");

    // limpeza do que o teste criou
    await s2.persistence.roomStore.remove(code);
  });
});
