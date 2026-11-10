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
export const MAX_GENRE_PICKS = 3;
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
  startedAt: number;
  durationMs: number;
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
  | "time_over";

export class GameError extends Error {
  constructor(public readonly code: GameErrorCode) {
    super(code);
    this.name = "GameError";
  }
}
