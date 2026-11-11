import { createServer } from "node:http";
import { loadEnvConfig } from "@next/env";
import next from "next";
import { createMockProvider, createMusicProvider } from "@/features/music";
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

  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const upgradeNext = app.getUpgradeHandler();

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
    idleMs: num(process.env.ROOM_IDLE_MS),
  });
  const restored = await manager.restore();
  const ws = createWsServer(manager);

  const server = createServer((req, res) => void handle(req, res));
  server.on("upgrade", (req, socket, head) => {
    // `/ws` é nosso; o restante (ex.: HMR do Next em dev) segue para o Next
    if (!ws.handleUpgrade(req, socket, head)) void upgradeNext(req, socket, head);
  });

  server.listen(port, () => {
    console.log(
      `> BeatRush Party em http://localhost:${port} (música: ${music.id}, persistência: ${persistence.kind}` +
        `${restored ? `, ${restored} sala(s) restaurada(s)` : ""})`,
    );
  });

  // Desligamento limpo: espera as gravações pendentes para não perder o último estado.
  let closing = false;
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
