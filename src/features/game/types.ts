export const GENRES = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Anos 80",
  "Sertanejo",
  "Funk",
  "MPB",
  "Eletrônica",
] as const;
export type Genre = (typeof GENRES)[number];

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
/** Cada jogador escolhe 1 gênero; a cada turno um dos escolhidos é sorteado. */
export const MAX_GENRE_PICKS = 1;
export const OPTION_COUNT = 4;

export type Phase = "lobby" | "genre-vote" | "playing" | "reveal" | "finished";

export interface Track {
  id: string;
  title: string;
  artist: string;
  coverUrl?: string;
  /** Trecho de áudio (ex.: preview de 30s). Tocado apenas no Host. */
  previewUrl?: string;
}

export interface Player {
  id: string;
  name: string;
  /** Índice na paleta de avatares. */
  avatar: number;
  connected: boolean;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
}

export interface RoundResult {
  correct: boolean;
  points: number;
  elapsedMs: number | null;
}

export interface Round {
  index: number;
  track: Track;
  /** Sempre OPTION_COUNT opções; a posição define a forma exibida. */
  options: Pick<Track, "title" | "artist">[];
  correctIndex: number;
  /** Instante (epoch ms) em que a música toca e as respostas abrem: o fim da contagem regressiva. */
  startedAt: number;
  durationMs: number;
  /** Duração da contagem "3, 2, 1" que antecede `startedAt` (0 = rodada começa na hora). */
  countdownMs: number;
  answers: Record<string, { choice: number; elapsedMs: number }>;
  results?: Record<string, RoundResult>;
}

export interface Room {
  code: string;
  hostPlayerId: string | null;
  phase: Phase;
  players: Player[];
  votes: Record<string, Genre[]>;
  voteEndsAt: number | null;
  topGenres: Genre[];
  totalRounds: number;
  /** Rodadas já concluídas (reveladas). */
  roundsPlayed: number;
  round: Round | null;
  replayVotes: string[];
}

export type GameErrorCode =
  | "room_full"
  | "name_taken"
  | "invalid_name"
  | "not_host"
  | "not_enough_players"
  | "wrong_phase"
  | "unknown_player"
  | "invalid_genres"
  | "invalid_choice"
  | "already_answered"
  | "too_early"
  | "time_over";

export class GameError extends Error {
  constructor(public readonly code: GameErrorCode) {
    super(code);
    this.name = "GameError";
  }
}
