import { tallyGenres, type Room } from "@/features/game";
import type { RoomView, RoundView } from "./protocol";

export type Viewer = { role: "display" } | { role: "player"; playerId: string };

/** Converte o estado interno no que o espectador pode ver (nunca vaza a resposta antes da revelação). */
export function projectRoom(room: Room, viewer: Viewer, now: number): RoomView {
  const revealed = room.phase === "reveal";
  let round: RoundView | null = null;

  if (room.round) {
    const r = room.round;
    round = {
      index: r.index,
      options: r.options,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
      answeredIds: Object.keys(r.answers),
    };
    if (viewer.role === "display" && room.phase === "playing") round.previewUrl = r.track.previewUrl;
    if (revealed && r.results) {
      round.reveal = {
        correctIndex: r.correctIndex,
        title: r.track.title,
        artist: r.track.artist,
        coverUrl: r.track.coverUrl,
        results: r.results,
      };
    }
  }

  const view: RoomView = {
    code: room.code,
    phase: room.phase,
    hostPlayerId: room.hostPlayerId,
    players: room.players.map(({ id, name, avatar, connected, score, streak, bestStreak, correct }) => ({
      id,
      name,
      avatar,
      connected,
      score,
      streak,
      bestStreak,
      correct,
    })),
    voteEndsAt: room.voteEndsAt,
    votedIds: Object.keys(room.votes),
    topGenres: room.topGenres,
    totalRounds: room.totalRounds,
    roundsPlayed: room.roundsPlayed,
    round,
    replayVotes: room.replayVotes,
    serverNow: now,
  };

  if (viewer.role === "display" && room.phase === "genre-vote") view.tally = tallyGenres(room);
  if (viewer.role === "player") {
    view.you = {
      playerId: viewer.playerId,
      votes: room.votes[viewer.playerId] ?? null,
      answer: room.round?.answers[viewer.playerId]?.choice ?? null,
    };
  }
  return view;
}
