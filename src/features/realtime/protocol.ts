import { z } from "zod";
import { GENRES, type GameErrorCode, type Genre, type Phase } from "@/features/game";

/** ---------- Cliente → Servidor ---------- */
export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("host:create") }),
  z.object({ type: z.literal("host:attach"), code: z.string().length(4) }),
  z.object({
    type: z.literal("player:join"),
    code: z.string().length(4),
    playerId: z.string().min(1).max(64),
    name: z.string().max(40),
    avatar: z.number().int().min(0).max(9),
  }),
  z.object({ type: z.literal("player:start") }),
  z.object({ type: z.literal("player:vote"), genres: z.array(z.enum(GENRES)).max(3) }),
  z.object({ type: z.literal("player:answer"), choice: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("player:replay") }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** ---------- Visões públicas (o que cada cliente pode saber) ---------- */
export interface PlayerView {
  id: string;
  name: string;
  avatar: number;
  connected: boolean;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
}

export interface RoundView {
  index: number;
  options: { title: string; artist: string }[];
  startedAt: number;
  durationMs: number;
  answeredIds: string[];
  /** Somente Host: áudio da faixa em reprodução. */
  previewUrl?: string;
  /** Somente em reveal. */
  reveal?: {
    correctIndex: number;
    title: string;
    artist: string;
    coverUrl?: string;
    results: Record<string, { correct: boolean; points: number; elapsedMs: number | null }>;
  };
}

export interface RoomView {
  code: string;
  phase: Phase;
  hostPlayerId: string | null;
  players: PlayerView[];
  voteEndsAt: number | null;
  votedIds: string[];
  /** Somente Host: placar parcial da votação. */
  tally?: { genre: Genre; votes: number }[];
  topGenres: Genre[];
  totalRounds: number;
  roundsPlayed: number;
  round: RoundView | null;
  replayVotes: string[];
  /** Relógio do servidor no envio, para compensar diferença de relógio. */
  serverNow: number;
  you?: { playerId: string; votes: Genre[] | null; answer: number | null };
}

/** ---------- Servidor → Cliente ---------- */
export type ServerMessage =
  | { type: "host:created"; code: string }
  | { type: "state"; view: RoomView }
  | { type: "error"; code: GameErrorCode | "room_not_found" | "bad_message" | "not_joined" };
