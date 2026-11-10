import { describe, expect, it } from "vitest";
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
  pointsFor,
  ranking,
  replayMajority,
  resetToLobby,
  setConnected,
  startGenreVote,
  startRound,
  submitAnswer,
  tallyGenres,
  voteGenres,
  voteReplay,
  type Room,
  type Track,
} from "./index";

const track = (n: number): Track => ({ id: `t${n}`, title: `Song ${n}`, artist: `Artist ${n}` });
const distractors = [track(2), track(3), track(4)];

function lobby(): Room {
  let r = createRoom("BEAT", 2);
  r = joinRoom(r, { id: "a", name: "Ana", avatar: 1 });
  r = joinRoom(r, { id: "b", name: "Carlos", avatar: 2 });
  return r;
}

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error("expected GameError " + code);
}

describe("pointsFor", () => {
  it("decai linearmente de 1000 a 300", () => {
    expect(pointsFor(0, 10_000)).toBe(1000);
    expect(pointsFor(5_000, 10_000)).toBe(650);
    expect(pointsFor(10_000, 10_000)).toBe(300);
  });
  it("limita valores fora do intervalo", () => {
    expect(pointsFor(-5, 10_000)).toBe(1000);
    expect(pointsFor(99_000, 10_000)).toBe(300);
  });
});

describe("lobby", () => {
  it("primeiro jogador vira host", () => {
    expect(lobby().hostPlayerId).toBe("a");
  });
  it("rejeita nome vazio, repetido e sala cheia", () => {
    const r = lobby();
    expectCode(() => joinRoom(r, { id: "x", name: "  ", avatar: 0 }), "invalid_name");
    expectCode(() => joinRoom(r, { id: "x", name: "ana", avatar: 0 }), "name_taken");
    let full = createRoom("FULL");
    for (let i = 0; i < 8; i++) full = joinRoom(full, { id: `p${i}`, name: `P${i}`, avatar: 0 });
    expectCode(() => joinRoom(full, { id: "z", name: "Z", avatar: 0 }), "room_full");
  });
  it("reentrada com mesmo id reconecta", () => {
    let r = setConnected(lobby(), "b", false);
    r = joinRoom(r, { id: "b", name: "qualquer", avatar: 0 });
    expect(r.players[1].connected).toBe(true);
  });
  it("host que sai passa o posto adiante", () => {
    expect(leaveRoom(lobby(), "a").hostPlayerId).toBe("b");
  });
  it("só o host inicia, com 2+ jogadores conectados", () => {
    expectCode(() => startGenreVote(lobby(), "b", 0, 1000), "not_host");
    expectCode(
      () => startGenreVote(setConnected(lobby(), "b", false), "a", 0, 1000),
      "not_enough_players",
    );
    expect(startGenreVote(lobby(), "a", 100, 1000)).toMatchObject({
      phase: "genre-vote",
      voteEndsAt: 1100,
    });
  });
});

describe("votação de gêneros", () => {
  const voting = () => startGenreVote(lobby(), "a", 0, 1000);

  it("valida limite e gêneros", () => {
    expectCode(() => voteGenres(voting(), "a", ["Pop", "Rock", "Funk", "MPB"]), "invalid_genres");
    expectCode(() => voteGenres(voting(), "a", ["Polka" as never]), "invalid_genres");
    expectCode(() => voteGenres(lobby(), "a", ["Pop"]), "wrong_phase");
  });
  it("apura os 3 mais votados, desempate pela ordem da lista", () => {
    let r = voting();
    r = voteGenres(r, "a", ["Funk", "Pop"]);
    r = voteGenres(r, "b", ["Funk", "Rock"]);
    expect(allVoted(r)).toBe(true);
    expect(tallyGenres(r)[0]).toEqual({ genre: "Funk", votes: 2 });
    expect(closeGenreVote(r).topGenres).toEqual(["Funk", "Pop", "Rock"]);
  });
  it("sem votos cai nos 3 primeiros gêneros", () => {
    expect(closeGenreVote(voting()).topGenres).toEqual(["Pop", "Rock", "Hip-Hop"]);
  });
});

describe("rodada", () => {
  const playing = () => {
    const round = buildRound(0, track(1), distractors, 1000, 10_000, () => 0);
    return startRound(closeGenreVote(startGenreVote(lobby(), "a", 0, 1)), round);
  };

  it("buildRound posiciona a correta e mantém 4 opções", () => {
    const round = buildRound(0, track(1), distractors, 0, 1, () => 0);
    expect(round.options).toHaveLength(4);
    expect(round.options[round.correctIndex].title).toBe("Song 1");
  });
  it("rejeita resposta duplicada, inválida e fora do tempo", () => {
    const r = submitAnswer(playing(), "a", 1, 2000);
    expectCode(() => submitAnswer(r, "a", 2, 2100), "already_answered");
    expectCode(() => submitAnswer(r, "b", 9, 2100), "invalid_choice");
    expectCode(() => submitAnswer(r, "b", 1, 99_000), "time_over");
    expectCode(() => submitAnswer(r, "zzz", 1, 2100), "unknown_player");
  });
  it("pontua acerto, zera sequência no erro e registra sem resposta", () => {
    let r = playing();
    const correct = r.round!.correctIndex;
    r = submitAnswer(r, "a", correct, 1000 + 1000);
    expect(allAnswered(r)).toBe(false);
    r = closeRound(r);
    const [a, b] = r.players;
    expect(a).toMatchObject({ score: 930, streak: 1, correct: 1 });
    expect(b).toMatchObject({ score: 0, streak: 0 });
    expect(r.round!.results!.b).toEqual({ correct: false, points: 0, elapsedMs: null });
    expect(r.phase).toBe("reveal");
    expect(r.roundsPlayed).toBe(1);
  });
  it("encerra o jogo e permite revanche por maioria", () => {
    let r = playing();
    r = closeRound(r);
    expect(isLastRound(r)).toBe(false);
    r = startRound(r, buildRound(1, track(1), distractors, 5000, 10_000, () => 0));
    r = closeRound(r);
    expect(isLastRound(r)).toBe(true);
    r = finishGame(r);
    expect(r.phase).toBe("finished");
    r = voteReplay(r, "a");
    expect(replayMajority(r)).toBe(false);
    r = voteReplay(voteReplay(r, "b"), "b");
    expect(replayMajority(r)).toBe(true);
    const reset = resetToLobby(r);
    expect(reset).toMatchObject({ phase: "lobby", roundsPlayed: 0, replayVotes: [] });
    expect(reset.players.every((p) => p.score === 0)).toBe(true);
  });
  it("ranking ordena por pontos e desempata por sequência", () => {
    let r = playing();
    r = submitAnswer(r, "b", r.round!.correctIndex, 1500);
    r = closeRound(r);
    expect(ranking(r).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
