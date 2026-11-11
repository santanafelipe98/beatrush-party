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
import { NullRoomStore } from "./persistence/memory-stores";
import {
  SNAPSHOT_VERSION,
  type Deadline,
  type DeadlineAction,
  type RoomSnapshot,
  type RoomStore,
} from "./persistence/types";

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
  /** Onde as salas são persistidas (padrão: nenhuma persistência). */
  store?: RoomStore;
  now?: () => number;
  timers?: Timers;
  rng?: () => number;
  voteMs?: number;
  roundMs?: number;
  revealMs?: number;
  totalRounds?: number;
  /** Atraso entre o fim da votação e a primeira música. */
  introMs?: number;
  /** Tempo sem nenhuma conexão até a sala ser removida da memória e do store. */
  idleMs?: number;
}

interface Runtime {
  room: Room;
  displays: Set<Connection>;
  players: Map<string, Connection>;
  queue: RoundTracks[];
  timer: unknown;
  /** Ação agendada (persistida, para ser rearmada após um reinício). */
  deadline: Deadline | null;
  /** Evita iniciar duas vezes enquanto o catálogo carrega. */
  busy: boolean;
  /** Fila de gravações: garante que a última mudança é a que fica salva. */
  writes: Promise<void>;
  idleTimer: unknown;
}

type Resolved = Required<Omit<ManagerOptions, "fallbackMusic">> & Pick<ManagerOptions, "fallbackMusic">;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export class RoomManager {
  private rooms = new Map<string, Runtime>();
  private bindings = new Map<Connection, { code: string; playerId?: string }>();
  private opts: Resolved;
  private lastStoreWarning = 0;

  constructor(options: ManagerOptions) {
    const defaults: Omit<Resolved, "music" | "fallbackMusic"> = {
      now: () => Date.now(),
      timers: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as never) },
      rng: Math.random,
      store: new NullRoomStore(),
      voteMs: 20_000,
      roundMs: 10_000,
      revealMs: 5_000,
      totalRounds: 12,
      introMs: 1_500,
      idleMs: 30 * 60_000,
    };
    // valores `undefined` (ex.: env não definida) não sobrescrevem os padrões
    const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
    this.opts = { ...defaults, ...given } as Resolved;
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
      this.touchIdle(rt);
      return;
    }
    if (rt.players.get(b.playerId) !== conn) return; // já reconectou por outro socket
    rt.players.delete(b.playerId);
    rt.room =
      rt.room.phase === "lobby" ? leaveRoom(rt.room, b.playerId) : setConnected(rt.room, b.playerId, false);
    this.afterPlayerChange(rt);
    this.commit(rt);
    this.touchIdle(rt);
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)?.room;
  }

  /**
   * Recarrega do store as salas de antes de um reinício. Ninguém está conectado ainda, então todos
   * os jogadores voltam como offline (reconectam sozinhos com o mesmo `playerId`) e o timer que
   * estava armado é rearmado pelo tempo que faltava. Retorna quantas salas foram restauradas.
   */
  async restore(): Promise<number> {
    const snapshots = await this.opts.store.loadAll();
    let restored = 0;
    for (const snap of snapshots) {
      const code = snap.room.code;
      if (this.rooms.has(code)) continue;
      const rt: Runtime = {
        room: { ...snap.room, players: snap.room.players.map((p) => ({ ...p, connected: false })) },
        displays: new Set(),
        players: new Map(),
        queue: snap.queue ?? [],
        timer: null,
        deadline: null,
        busy: false,
        writes: Promise.resolve(),
        idleTimer: null,
      };
      this.rooms.set(code, rt);
      this.resume(rt, snap.deadline);
      this.touchIdle(rt);
      restored++;
    }
    return restored;
  }

  /** Aguarda as gravações pendentes (use antes de encerrar o processo). */
  async flush(): Promise<void> {
    await Promise.all([...this.rooms.values()].map((rt) => rt.writes));
  }

  /** Cancela timers pendentes (shutdown/testes). Não apaga nada do store. */
  dispose(): void {
    for (const rt of this.rooms.values()) {
      this.clear(rt);
      if (rt.idleTimer != null) this.opts.timers.clearTimeout(rt.idleTimer);
    }
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
      deadline: null,
      busy: false,
      writes: Promise.resolve(),
      idleTimer: null,
    };
    this.rooms.set(code, rt);
    this.bindings.set(conn, { code });
    this.persist(rt);
    conn.send({ type: "host:created", code });
    this.send(rt, conn, { role: "display" });
  }

  private attachDisplay(conn: Connection, code: string) {
    const rt = this.rooms.get(code);
    if (!rt) return void conn.send({ type: "error", code: "room_not_found" });
    rt.displays.add(conn);
    this.bindings.set(conn, { code });
    this.touchIdle(rt);
    this.send(rt, conn, { role: "display" });
  }

  private join(conn: Connection, msg: Extract<ClientMessage, { type: "player:join" }>) {
    const rt = this.rooms.get(msg.code.toUpperCase());
    if (!rt) return void conn.send({ type: "error", code: "room_not_found" });
    rt.room = joinRoom(rt.room, { id: msg.playerId, name: msg.name, avatar: msg.avatar });
    rt.players.set(msg.playerId, conn);
    this.bindings.set(conn, { code: rt.room.code, playerId: msg.playerId });
    this.touchIdle(rt);
    this.commit(rt);
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
        this.arm(rt, "endVote", this.opts.voteMs);
        break;
      case "player:vote":
        rt.room = voteGenres(rt.room, id, msg.genres);
        if (allVoted(rt.room)) {
          this.commit(rt);
          return void this.endVote(rt);
        }
        break;
      case "player:answer":
        rt.room = submitAnswer(rt.room, id, msg.choice, now);
        if (allAnswered(rt.room)) {
          this.commit(rt);
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
    this.commit(rt);
  }

  /* ------------------------------ fluxo ------------------------------ */

  private async endVote(rt: Runtime) {
    if (rt.busy || rt.room.phase !== "genre-vote") return;
    rt.busy = true;
    this.clear(rt);
    rt.room = closeGenreVote(rt.room);
    this.commit(rt);
    await this.loadQueueAndStart(rt);
  }

  /** Sorteia as músicas e agenda a primeira rodada. Também é usado ao retomar após um reinício. */
  private async loadQueueAndStart(rt: Runtime) {
    rt.busy = true;
    try {
      rt.queue = await this.loadTracks(rt);
    } catch (e) {
      console.error("[game] não foi possível carregar músicas:", e);
      return;
    } finally {
      rt.busy = false;
    }
    if (this.rooms.get(rt.room.code) !== rt) return; // sala removida enquanto carregava
    this.arm(rt, "nextRound", this.opts.introMs);
    this.persist(rt);
  }

  private async loadTracks(rt: Runtime): Promise<RoundTracks[]> {
    const { totalRounds, topGenres } = rt.room;
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
    this.arm(rt, "endRound", this.opts.roundMs);
    this.commit(rt);
  }

  private endRound(rt: Runtime) {
    if (rt.room.phase !== "playing") return;
    this.clear(rt);
    rt.room = closeRound(rt.room);
    this.arm(rt, "afterReveal", this.opts.revealMs);
    this.commit(rt);
  }

  private afterReveal(rt: Runtime) {
    if (rt.room.phase !== "reveal") return;
    if (isLastRound(rt.room)) {
      rt.room = finishGame(rt.room);
      this.commit(rt);
    } else {
      this.nextRound(rt);
    }
  }

  /** Se todos os conectados já responderam/votaram após uma desconexão, avança. */
  private afterPlayerChange(rt: Runtime) {
    const connected = rt.room.players.some((p) => p.connected);
    if (!connected) return;
    if (rt.room.phase === "playing" && allAnswered(rt.room)) this.endRound(rt);
    else if (rt.room.phase === "genre-vote" && allVoted(rt.room)) void this.endVote(rt);
  }

  /* ------------------------------ timers ------------------------------ */

  /** Agenda uma ação nomeada (e não um closure), para poder ser persistida e rearmada. */
  private arm(rt: Runtime, action: DeadlineAction, ms: number) {
    this.clear(rt);
    rt.deadline = { action, at: this.opts.now() + ms };
    rt.timer = this.opts.timers.setTimeout(() => this.fire(rt, action), ms);
  }

  private fire(rt: Runtime, action: DeadlineAction) {
    rt.timer = null;
    rt.deadline = null;
    try {
      switch (action) {
        case "endVote":
          return void this.endVote(rt);
        case "nextRound":
          return this.nextRound(rt);
        case "endRound":
          return this.endRound(rt);
        case "afterReveal":
          return this.afterReveal(rt);
      }
    } catch (e) {
      // um timer que dispara fora de hora não pode derrubar o processo
      console.error(`[game] ação "${action}" falhou na sala ${rt.room.code}:`, e);
    }
  }

  private clear(rt: Runtime) {
    if (rt.timer != null) this.opts.timers.clearTimeout(rt.timer);
    rt.timer = null;
    rt.deadline = null;
  }

  /** Rearma o que estava pendente quando o servidor parou. */
  private resume(rt: Runtime, deadline: Deadline | null) {
    const now = this.opts.now();
    const { phase, round, voteEndsAt } = rt.room;

    if (deadline) return this.arm(rt, deadline.action, Math.max(0, deadline.at - now));

    // sem prazo salvo: deduz pela fase (ex.: parou enquanto as músicas carregavam)
    if (phase === "genre-vote" && voteEndsAt === null && !rt.busy) void this.loadQueueAndStart(rt);
    else if (phase === "genre-vote" && voteEndsAt !== null) this.arm(rt, "endVote", Math.max(0, voteEndsAt - now));
    else if (phase === "playing" && round) this.arm(rt, "endRound", Math.max(0, round.startedAt + round.durationMs - now));
    else if (phase === "reveal") this.arm(rt, "afterReveal", this.opts.revealMs);
  }

  /** Remove a sala (memória + store) se ninguém estiver conectado por `idleMs`. */
  private touchIdle(rt: Runtime) {
    if (rt.idleTimer != null) this.opts.timers.clearTimeout(rt.idleTimer);
    rt.idleTimer = null;
    if (rt.displays.size > 0 || rt.players.size > 0) return;
    rt.idleTimer = this.opts.timers.setTimeout(() => this.sweep(rt), this.opts.idleMs);
  }

  private sweep(rt: Runtime) {
    if (rt.displays.size > 0 || rt.players.size > 0) return;
    this.clear(rt);
    rt.idleTimer = null;
    this.rooms.delete(rt.room.code);
    // na mesma fila das gravações, para uma gravação atrasada não "ressuscitar" a sala
    rt.writes = rt.writes
      .then(() => this.opts.store.remove(rt.room.code))
      .catch((e) => this.warnStore("remover sala", e));
  }

  /* ------------------------------ persistência e envio ------------------------------ */

  private persist(rt: Runtime) {
    const snapshot: RoomSnapshot = {
      v: SNAPSHOT_VERSION,
      room: rt.room,
      queue: [...rt.queue],
      deadline: rt.deadline,
      savedAt: this.opts.now(),
    };
    rt.writes = rt.writes
      .then(() => this.opts.store.save(snapshot))
      .catch((e) => this.warnStore("salvar sala", e));
  }

  /** O jogo continua em memória se o store falhar; só avisamos (no máximo 1x por 30s). */
  private warnStore(what: string, error: unknown) {
    const now = Date.now();
    if (now - this.lastStoreWarning < 30_000) return;
    this.lastStoreWarning = now;
    console.warn(`[store] falha ao ${what}:`, error instanceof Error ? error.message : error);
  }

  private commit(rt: Runtime) {
    this.persist(rt);
    this.broadcast(rt);
  }

  private send(rt: Runtime, conn: Connection, viewer: Viewer) {
    conn.send({ type: "state", view: projectRoom(rt.room, viewer, this.opts.now()) });
  }

  private broadcast(rt: Runtime) {
    for (const d of rt.displays) this.send(rt, d, { role: "display" });
    for (const [playerId, c] of rt.players) this.send(rt, c, { role: "player", playerId });
  }
}
