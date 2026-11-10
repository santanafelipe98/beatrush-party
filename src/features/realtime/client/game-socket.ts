import type { ClientMessage, ServerMessage } from "../protocol";

export type ConnectionStatus = "connecting" | "open" | "closed";

interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export interface GameSocketOptions {
  url: string;
  /** Mensagens enviadas a cada (re)conexão, ex.: player:join ou host:attach. */
  onOpenMessages: () => ClientMessage[];
  onMessage: (m: ServerMessage) => void;
  onStatus: (s: ConnectionStatus) => void;
  /** Injetável para testes. */
  createSocket?: (url: string) => SocketLike;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

const OPEN = 1;

/** WebSocket com reconexão exponencial (0,5s → 5s) e retomada de sessão. */
export class GameSocket {
  private socket: SocketLike | null = null;
  private attempts = 0;
  private timer: unknown = null;
  private stopped = false;

  constructor(private opts: GameSocketOptions) {}

  connect(): void {
    this.stopped = false;
    this.opts.onStatus("connecting");
    const create = this.opts.createSocket ?? ((u: string) => new WebSocket(u) as unknown as SocketLike);
    const socket = create(this.opts.url);
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.opts.onStatus("open");
      for (const m of this.opts.onOpenMessages()) this.send(m);
    };
    socket.onmessage = (ev) => {
      try {
        this.opts.onMessage(JSON.parse(String(ev.data)) as ServerMessage);
      } catch {
        /* mensagem malformada: ignora */
      }
    };
    socket.onclose = () => {
      this.opts.onStatus("closed");
      if (this.stopped) return;
      const delay = Math.min(500 * 2 ** this.attempts++, 5000);
      this.timer = (this.opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms)))(() => this.connect(), delay);
    };
  }

  send(message: ClientMessage): boolean {
    if (this.socket?.readyState !== OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.stopped = true;
    if (this.timer != null) (this.opts.clearTimer ?? ((h) => clearTimeout(h as never)))(this.timer);
    this.socket?.close();
  }
}

export function defaultWsUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
}
