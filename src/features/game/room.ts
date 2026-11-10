import { pointsFor } from "./scoring";
import {
  GENRES,
  GameError,
  MAX_GENRE_PICKS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  OPTION_COUNT,
  type Genre,
  type Phase,
  type Player,
  type Room,
  type Round,
  type Track,
} from "./types";

export function createRoom(code: string, totalRounds = 12): Room {
  return {
    code,
    hostPlayerId: null,
    phase: "lobby",
    players: [],
    votes: {},
    voteEndsAt: null,
    topGenres: [],
    totalRounds,
    roundsPlayed: 0,
    round: null,
    replayVotes: [],
  };
}

function requirePhase(room: Room, ...phases: Phase[]) {
  if (!phases.includes(room.phase)) throw new GameError("wrong_phase");
}

function requirePlayer(room: Room, id: string): Player {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new GameError("unknown_player");
  return p;
}

function mapPlayer(room: Room, id: string, fn: (p: Player) => Player): Room {
  return { ...room, players: room.players.map((p) => (p.id === id ? fn(p) : p)) };
}

/** Entrada (ou reentrada, se o id já existe) de um jogador. */
export function joinRoom(
  room: Room,
  input: { id: string; name: string; avatar: number },
): Room {
  if (room.players.some((p) => p.id === input.id))
    return mapPlayer(room, input.id, (p) => ({ ...p, connected: true }));

  requirePhase(room, "lobby");
  const name = input.name.trim().slice(0, 16);
  if (!name) throw new GameError("invalid_name");
  if (room.players.length >= MAX_PLAYERS) throw new GameError("room_full");
  if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
    throw new GameError("name_taken");

  const player: Player = {
    id: input.id,
    name,
    avatar: input.avatar,
    connected: true,
    score: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
  };
  return {
    ...room,
    hostPlayerId: room.hostPlayerId ?? player.id,
    players: [...room.players, player],
  };
}

export function setConnected(room: Room, id: string, connected: boolean): Room {
  requirePlayer(room, id);
  return mapPlayer(room, id, (p) => ({ ...p, connected }));
}

/** Remove jogador (apenas no lobby); repassa o posto de host se necessário. */
export function leaveRoom(room: Room, id: string): Room {
  requirePhase(room, "lobby");
  const players = room.players.filter((p) => p.id !== id);
  return {
    ...room,
    players,
    hostPlayerId:
      room.hostPlayerId === id ? (players[0]?.id ?? null) : room.hostPlayerId,
  };
}

export function startGenreVote(
  room: Room,
  by: string,
  now: number,
  durationMs: number,
): Room {
  requirePhase(room, "lobby");
  if (room.hostPlayerId !== by) throw new GameError("not_host");
  if (room.players.filter((p) => p.connected).length < MIN_PLAYERS)
    throw new GameError("not_enough_players");
  return { ...room, phase: "genre-vote", votes: {}, voteEndsAt: now + durationMs };
}

export function voteGenres(room: Room, id: string, genres: Genre[]): Room {
  requirePhase(room, "genre-vote");
  requirePlayer(room, id);
  const unique = [...new Set(genres)];
  if (unique.length > MAX_GENRE_PICKS || unique.some((g) => !GENRES.includes(g)))
    throw new GameError("invalid_genres");
  return { ...room, votes: { ...room.votes, [id]: unique } };
}

export function allVoted(room: Room): boolean {
  return room.players.filter((p) => p.connected).every((p) => room.votes[p.id]);
}

export function tallyGenres(room: Room): { genre: Genre; votes: number }[] {
  const counts = new Map<Genre, number>(GENRES.map((g) => [g, 0]));
  for (const picks of Object.values(room.votes))
    for (const g of picks) counts.set(g, (counts.get(g) ?? 0) + 1);
  // sort estável: empates seguem a ordem de GENRES
  return GENRES.map((genre) => ({ genre, votes: counts.get(genre) ?? 0 })).sort(
    (a, b) => b.votes - a.votes,
  );
}

/** Encerra a votação e fixa os 3 gêneros mais votados. */
export function closeGenreVote(room: Room): Room {
  requirePhase(room, "genre-vote");
  const topGenres = tallyGenres(room)
    .slice(0, MAX_GENRE_PICKS)
    .map((t) => t.genre);
  return { ...room, topGenres, voteEndsAt: null };
}

/** Monta uma rodada embaralhando a faixa correta entre os distratores. */
export function buildRound(
  index: number,
  track: Track,
  distractors: Track[],
  startedAt: number,
  durationMs: number,
  rng: () => number = Math.random,
): Round {
  if (distractors.length < OPTION_COUNT - 1) throw new GameError("invalid_choice");
  const options = [track, ...distractors.slice(0, OPTION_COUNT - 1)].map(
    ({ title, artist }) => ({ title, artist }),
  );
  // Fisher-Yates guardando onde a correta (posição 0) vai parar
  const order = options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    index,
    track,
    options: order.map((i) => options[i]),
    correctIndex: order.indexOf(0),
    startedAt,
    durationMs,
    answers: {},
  };
}

export function startRound(room: Room, round: Round): Room {
  requirePhase(room, "genre-vote", "reveal");
  return { ...room, phase: "playing", round };
}

export function submitAnswer(
  room: Room,
  id: string,
  choice: number,
  now: number,
): Room {
  requirePhase(room, "playing");
  requirePlayer(room, id);
  const round = room.round!;
  if (!Number.isInteger(choice) || choice < 0 || choice >= OPTION_COUNT)
    throw new GameError("invalid_choice");
  if (round.answers[id]) throw new GameError("already_answered");
  const elapsedMs = now - round.startedAt;
  if (elapsedMs > round.durationMs) throw new GameError("time_over");
  return {
    ...room,
    round: {
      ...round,
      answers: { ...round.answers, [id]: { choice, elapsedMs: Math.max(0, elapsedMs) } },
    },
  };
}

export function allAnswered(room: Room): boolean {
  if (!room.round) return false;
  const answers = room.round.answers;
  return room.players.filter((p) => p.connected).every((p) => answers[p.id]);
}

/** Pontua a rodada e entra na fase de revelação. */
export function closeRound(room: Room): Room {
  requirePhase(room, "playing");
  const round = room.round!;
  const results: NonNullable<Round["results"]> = {};
  const players = room.players.map((p) => {
    const a = round.answers[p.id];
    const correct = !!a && a.choice === round.correctIndex;
    const points = correct ? pointsFor(a.elapsedMs, round.durationMs) : 0;
    results[p.id] = { correct, points, elapsedMs: a?.elapsedMs ?? null };
    const streak = correct ? p.streak + 1 : 0;
    return {
      ...p,
      score: p.score + points,
      streak,
      bestStreak: Math.max(p.bestStreak, streak),
      correct: p.correct + (correct ? 1 : 0),
    };
  });
  return {
    ...room,
    phase: "reveal",
    players,
    roundsPlayed: room.roundsPlayed + 1,
    round: { ...round, results },
  };
}

export function isLastRound(room: Room): boolean {
  return room.roundsPlayed >= room.totalRounds;
}

export function finishGame(room: Room): Room {
  requirePhase(room, "reveal");
  return { ...room, phase: "finished", round: null, replayVotes: [] };
}

export function voteReplay(room: Room, id: string): Room {
  requirePhase(room, "finished");
  requirePlayer(room, id);
  if (room.replayVotes.includes(id)) return room;
  return { ...room, replayVotes: [...room.replayVotes, id] };
}

export function replayMajority(room: Room): boolean {
  const connected = room.players.filter((p) => p.connected).length;
  return connected > 0 && room.replayVotes.length > connected / 2;
}

/** Volta ao lobby zerando placar e votos (mantém jogadores). */
export function resetToLobby(room: Room): Room {
  requirePhase(room, "finished");
  return {
    ...room,
    phase: "lobby",
    players: room.players.map((p) => ({
      ...p,
      score: 0,
      streak: 0,
      bestStreak: 0,
      correct: 0,
    })),
    votes: {},
    topGenres: [],
    roundsPlayed: 0,
    round: null,
    replayVotes: [],
  };
}

export function ranking(room: Room): Player[] {
  return [...room.players].sort(
    (a, b) => b.score - a.score || b.bestStreak - a.bestStreak,
  );
}
