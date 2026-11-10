import { createServer } from "node:http";
import next from "next";
import { createMockProvider, createMusicProvider } from "@/features/music";
import { RoomManager } from "@/server/room-manager";
import { createWsServer } from "@/server/ws-server";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const num = (v: string | undefined) => (v ? Number(v) : undefined);

async function main() {
  const app = next({ dev, port });
  const handle = app.getRequestHandler();
  await app.prepare();
  const upgradeNext = app.getUpgradeHandler();

  const music = createMusicProvider();
  const manager = new RoomManager({
    music,
    fallbackMusic: music.id === "mock" ? undefined : createMockProvider(),
    voteMs: num(process.env.VOTE_MS),
    roundMs: num(process.env.ROUND_MS),
    revealMs: num(process.env.REVEAL_MS),
    totalRounds: num(process.env.TOTAL_ROUNDS),
  });
  const ws = createWsServer(manager);

  const server = createServer((req, res) => void handle(req, res));
  server.on("upgrade", (req, socket, head) => {
    // `/ws` é nosso; o restante (ex.: HMR do Next em dev) segue para o Next
    if (!ws.handleUpgrade(req, socket, head)) void upgradeNext(req, socket, head);
  });

  server.listen(port, () => {
    console.log(`> BeatRush Party em http://localhost:${port} (música: ${music.id})`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
