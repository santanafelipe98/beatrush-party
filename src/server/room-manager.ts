import {
  GameError,
  allAnswered,
  allVoted,
  buildRound,
  closeGenreVote,
  closeRound,
  createRoom,
  finishGame,
  isLastRound,
  joinRoom,
  leaveRoom,
  replayMajority,
  resetToLobby,
  setConnected,
  startGenreVote,
  startRound,
  submitAnswer,
  voteGenres,
  voteReplay,
  type Room,
} from "@/features/game";
import type { MusicProvider, RoundTracks } from "@/features/music";
import { selectRoundTracks } from "@/features/music";
import type { ClientMessage, ServerMessage } from "@/features/realtime/protocol";
import { projectRoom, type Viewer } from "@/features/realtime/projection";

/** Abstração mínima de um socket, para testar sem rede. */
export interface Connection {
  send(message: ServerMessage): void;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ManagerOptions {
  music: MusicProvider;
  /** Usado quando o provedor principal falha. */
  fallbackMusic?: MusicProvider;
  now?: () => number;
  timers?: Timers;
  rng?: () => number;
  voteMs?: number;
  roundMs?: number;
  revealMs?: number;
  totalRounds?: number;
  /** Atraso entre o fim da votação e a primeira música. */
  introMs?: number;
}

interface Runtime {
  room: Room;
  displays: Set<Connection>;
  players: Map<string, Connection>;
  queue: RoundTracks[];
  timer: unknown;
  /** Evita iniciar duas vezes enquanto o catálogo carrega. */
  busy: boolean;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export class RoomManager {
  private rooms = new Map<string, Runtime>();
  private bindings = new Map<Connection, { code: string; playerId?: string }>();
  private opts: Required<Omit<ManagerOptions, "fallbackMusic">> & Pick<ManagerOptions, "fallbackMusic">;

  constructor(options: ManagerOptions) {
    this.opts = {
      now: () => Date.now(),
      timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as never) },
      rng: Math.random,
      voteMs: 20_000,
      roundMs: 10_000,
      revealMs: 5_000,
      totalRounds: 12,
      introMs: 1_500,
      // valores `undefined` (ex.: env não definida) não sobrescrevem os padrões
      ...Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)),
    } as typeof this.opts;
  }

  /* ------------------------------ entrada ------------------------------ */

  handle(conn: Connection, msg: ClientMessage): void {
    try {
      switch (msg.type) {
        case "host:create":
          return this.createDisplayRoom(conn);
        case "host:attach":
          return this.attachDisplay(conn, msg.code.toUpperCase());
        case "player:join":
          return this.join(conn, msg);
        default:
          return this.playerAction(conn, msg);
      }
    } catch (e) {
      if (e instanceof GameError) conn.send({ type: "error", code: e.code });
      else throw e;
    }
  }

  disconnect(conn: Connection): void {
    const b = this.bindings.get(conn);
    this.bindings.delete(conn);
    if (!b) return;
    const rt = this.rooms.get(b.code);
    if (!rt) return;
    if (!b.playerId) {
      rt.displays.delete(conn);
      return;
    }
    if (rt.players.get(b.playerId) !== conn) return; // já reconectou por outro socket
    rt.players.delete(b.playerId);
    rt.room =
      rt.room.phase === "lobby" ? leaveRoom(rt.room, b.playerId) : setConnected(rt.room, b.playerId, false);
    this.afterPlayerChange(rt);
    this.broadcast(rt);
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)?.room;
  }

  /** Cancela timers pendentes (shutdown/testes). */
  dispose(): void {
    for (const rt of this.rooms.values()) this.clear(rt);
    this.rooms.clear();
  }

  /* ------------------------------ salas ------------------------------ */

  private newCode(): string {
    for (;;) {
      const code = Array.from(
        { length: 4 },
        () => CODE_ALPHABET[Math.floor(this.opts.rng() * CODE_ALPHABET.length)],
      ).join("");
      if (!this.rooms.has(code)) return code;
    }
  }

  private createDisplayRoom(conn: Connection) {
    const code = this.newCode();
    const rt: Runtime = {
      room: createRoom(code, this.opts.totalRounds),
      displays: new Set([conn]),
      players: new Map(),
      queue: [],
      timer: null,
      busy: false,
    };
    this.rooms.set(code, rt);
    this.bindings.set(conn, { code });
    conn.send({ type: "host:created", code });
    this.send(rt, conn, { role: "display" });
  }

  private attachDisplay(conn: Connection, code: string) {
    const rt = this.rooms.get(code);
    if (!rt) return void conn.send({ type: "error", code: "room_not_found" });
    rt.displays.add(conn);
    this.bindings.set(conn, { code });
    this.send(rt, conn, { role: "display" });
  }

  private join(conn: Connection, msg: Extract<ClientMessage, { type: "player:join" }>) {
    const rt = this.rooms.get(msg.code.toUpperCase());
    if (!rt) return void conn.send({ type: "error", code: "room_not_found" });
    rt.room = joinRoom(rt.room, { id: msg.playerId, name: msg.name, avatar: msg.avatar });
    rt.players.set(msg.playerId, conn);
    this.bindings.set(conn, { code: rt.room.code, playerId: msg.playerId });
    this.broadcast(rt);
  }

  private playerAction(conn: Connection, msg: ClientMessage) {
    const b = this.bindings.get(conn);
    if (!b?.playerId) return void conn.send({ type: "error", code: "not_joined" });
    const rt = this.rooms.get(b.code);
    if (!rt) return void conn.send({ type: "error", code: "room_not_found" });
    const id = b.playerId;
    const now = this.opts.now();

    switch (msg.type) {
      case "player:start":
        rt.room = startGenreVote(rt.room, id, now, this.opts.voteMs);
        this.schedule(rt, this.opts.voteMs, () => void this.endVote(rt));
        break;
      case "player:vote":
        rt.room = voteGenres(rt.room, id, msg.genres);
        if (allVoted(rt.room)) {
          this.broadcast(rt);
          return void this.endVote(rt);
        }
        break;
      case "player:answer":
        rt.room = submitAnswer(rt.room, id, msg.choice, now);
        if (allAnswered(rt.room)) {
          this.broadcast(rt);
          return this.endRound(rt);
        }
        break;
      case "player:replay":
        rt.room = voteReplay(rt.room, id);
        if (replayMajority(rt.room)) rt.room = resetToLobby(rt.room);
        break;
      default:
        return;
    }
    this.broadcast(rt);
  }

  /* ------------------------------ fluxo ------------------------------ */

  private async endVote(rt: Runtime) {
    if (rt.busy || rt.room.phase !== "genre-vote") return;
    rt.busy = true;
    this.clear(rt);
    rt.room = closeGenreVote(rt.room);
    this.broadcast(rt);
    try {
      rt.queue = await this.loadTracks(rt);
    } catch (e) {
      console.error("[game] não foi possível carregar músicas:", e);
      return;
    } finally {
      rt.busy = false;
    }
    if (!this.rooms.has(rt.room.code)) return;
    this.schedule(rt, this.opts.introMs, () => this.nextRound(rt));
  }

  private async loadTracks(rt: Runtime): Promise<RoundTracks[]> {
    const { totalRounds } = rt.room;
    const { topGenres } = rt.room;
    try {
      return await selectRoundTracks(this.opts.music, topGenres, totalRounds, this.opts.rng);
    } catch (e) {
      console.error(`[music] ${this.opts.music.id} falhou:`, e);
      if (!this.opts.fallbackMusic) throw e;
      return selectRoundTracks(this.opts.fallbackMusic, topGenres, totalRounds, this.opts.rng);
    }
  }

  private nextRound(rt: Runtime) {
    const next = rt.queue.shift();
    if (!next) return;
    const round = buildRound(
      rt.room.roundsPlayed,
      next.track,
      next.distractors,
      this.opts.now(),
      this.opts.roundMs,
      this.opts.rng,
    );
    rt.room = startRound(rt.room, round);
    this.broadcast(rt);
    this.schedule(rt, this.opts.roundMs, () => this.endRound(rt));
  }

  private endRound(rt: Runtime) {
    if (rt.room.phase !== "playing") return;
    this.clear(rt);
    rt.room = closeRound(rt.room);
    this.broadcast(rt);
    this.schedule(rt, this.opts.revealMs, () => {
      if (isLastRound(rt.room)) {
        rt.room = finishGame(rt.room);
        this.broadcast(rt);
      } else {
        this.nextRound(rt);
      }
    });
  }

  /** Se todos os conectados já responderam/votaram após uma desconexão, avança. */
  private afterPlayerChange(rt: Runtime) {
    const connected = rt.room.players.some((p) => p.connected);
    if (!connected) return;
    if (rt.room.phase === "playing" && allAnswered(rt.room)) this.endRound(rt);
    else if (rt.room.phase === "genre-vote" && allVoted(rt.room)) void this.endVote(rt);
  }

  /* ------------------------------ infra ------------------------------ */

  private schedule(rt: Runtime, ms: number, fn: () => void) {
    this.clear(rt);
    rt.timer = this.opts.timers.setTimeout(fn, ms);
  }

  private clear(rt: Runtime) {
    if (rt.timer != null) this.opts.timers.clearTimeout(rt.timer);
    rt.timer = null;
  }

  private send(rt: Runtime, conn: Connection, viewer: Viewer) {
    conn.send({ type: "state", view: projectRoom(rt.room, viewer, this.opts.now()) });
  }

  private broadcast(rt: Runtime) {
    for (const d of rt.displays) this.send(rt, d, { role: "display" });
    for (const [playerId, c] of rt.players) this.send(rt, c, { role: "player", playerId });
  }
}
