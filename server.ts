import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { createMockProvider, createMusicProvider } from "@/features/music";
import { createHealthHandler } from "@/server/health";
import { createPersistence } from "@/server/persistence";
import { RoomManager } from "@/server/room-manager";
import { createWsServer } from "@/server/ws-server";

const dev = process.env.NODE_ENV !== "production";
// Carrega .env / .env.local ANTES de ler REDIS_URL e afins (o Next só faz isso mais tarde).
loadEnvConfig(process.cwd(), dev);
const port = Number(process.env.PORT ?? 3000);
const num = (v: string | undefined) => (v ? Number(v) : undefined);

async function main() {
  // Primeiro: se o Redis está configurado e fora do ar, falha antes de subir o resto.
  const persistence = await createPersistence();

  // O HTTP sobe ANTES do Next e da restauração das salas: assim /healthz responde já e /readyz
  // devolve 503 "starting" até tudo ficar pronto (e "draining" ao desligar).
  let ready = false;
  let closing = false;
  const health = createHealthHandler({
    isReady: () => ready,
    isDraining: () => closing,
    pingRedis: persistence.ping,
  });
  let handle: (req: IncomingMessage, res: ServerResponse) => unknown = () => {};
  let upgradeNext: (req: IncomingMessage, socket: Duplex, head: Buffer) => unknown = () => {};
  let ws: ReturnType<typeof createWsServer> | null = null;

  const server = createServer((req, res) => {
    if (health(req, res)) return;
    if (!ready) {
      res.writeHead(503, { "retry-after": "2", "content-type": "text/plain; charset=utf-8" });
      return void res.end("Iniciando…");
    }
    void handle(req, res);
  });
  server.on("upgrade", (req, socket, head) => {
    if (!ready || !ws) return void socket.destroy(); // ainda subindo
    // `/ws` é nosso; o restante (ex.: HMR do Next em dev) segue para o Next
    if (!ws.handleUpgrade(req, socket, head)) void upgradeNext(req, socket, head);
  });
  await new Promise<void>((resolve) => server.listen(port, resolve));

  const app = next({ dev, port });
  handle = app.getRequestHandler();
  await app.prepare();
  upgradeNext = app.getUpgradeHandler();

  // Sem cache de faixas: os links de preview do Deezer são assinados e expiram em ~14 min.
  const music = createMusicProvider();
  const manager = new RoomManager({
    music,
    fallbackMusic: music.id === "mock" ? undefined : createMockProvider(),
    store: persistence.roomStore,
    voteMs: num(process.env.VOTE_MS),
    roundMs: num(process.env.ROUND_MS),
    revealMs: num(process.env.REVEAL_MS),
    totalRounds: num(process.env.TOTAL_ROUNDS),
    countdownMs: num(process.env.COUNTDOWN_MS),
    idleMs: num(process.env.ROOM_IDLE_MS),
  });
  const restored = await manager.restore();
  ws = createWsServer(manager);
  ready = true;
  console.log(
    `> BeatRush Party em http://localhost:${port} (música: ${music.id}, persistência: ${persistence.kind}` +
      `${restored ? `, ${restored} sala(s) restaurada(s)` : ""})`,
  );

  // Desligamento limpo: espera as gravações pendentes para não perder o último estado.
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`> ${signal}: encerrando…`);
    server.close();
    try {
      await manager.flush();
    } finally {
      manager.dispose();
      await persistence.close();
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
