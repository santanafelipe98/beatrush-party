import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { clientMessageSchema, type ServerMessage } from "@/features/realtime/protocol";
import { RoomManager, type Connection } from "./room-manager";

export const WS_PATH = "/ws";

/** Liga o RoomManager a conexões WebSocket em `/ws`. Devolve o handler de upgrade. */
export function createWsServer(manager: RoomManager) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket: WebSocket) => {
    const conn: Connection = {
      send(message: ServerMessage) {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
      },
    };
    const alive = { value: true };
    socket.on("pong", () => (alive.value = true));
    const heartbeat = setInterval(() => {
      if (!alive.value) return socket.terminate();
      alive.value = false;
      socket.ping();
    }, 15_000);

    socket.on("message", (raw) => {
      let parsed;
      try {
        parsed = clientMessageSchema.safeParse(JSON.parse(raw.toString()));
      } catch {
        parsed = null;
      }
      if (!parsed?.success) return conn.send({ type: "error", code: "bad_message" });
      try {
        manager.handle(conn, parsed.data);
      } catch (e) {
        console.error("[ws] erro inesperado:", e);
      }
    });
    socket.on("close", () => {
      clearInterval(heartbeat);
      manager.disconnect(conn);
    });
  });

  /** Retorna true se o upgrade era nosso. */
  function handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname !== WS_PATH) return false;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    return true;
  }

  function attach(server: Server) {
    server.on("upgrade", (req, socket, head) => {
      handleUpgrade(req, socket, head);
    });
  }

  return { wss, handleUpgrade, attach };
}
