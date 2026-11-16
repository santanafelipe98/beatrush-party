import { describe, expect, it } from "vitest";
import {
  EARLY_GRACE_MS,
  GameError,
  allAnswered,
  allVoted,
  buildRound,
  closeGenreVote,
  genrePicks,
  closeRound,
  countdownStep,
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
    expectCode(() => voteGenres(voting(), "a", ["Pop", "Rock"]), "invalid_genres"); // só 1 por jogador
    expectCode(() => voteGenres(voting(), "a", ["Polka" as never]), "invalid_genres");
    expectCode(() => voteGenres(lobby(), "a", ["Pop"]), "wrong_phase");
  });
  it("cada jogador escolhe 1 gênero; todos os escolhidos entram, do mais ao menos escolhido", () => {
    let r = voting();
    r = voteGenres(r, "a", ["Funk"]);
    r = voteGenres(r, "b", ["Rock"]);
    expect(allVoted(r)).toBe(true);
    expect(genrePicks(r).sort()).toEqual(["Funk", "Rock"]);
    expect(closeGenreVote(r).topGenres).toEqual(["Rock", "Funk"]); // empate: ordem de GENRES
  });
  it("gênero escolhido por 2 jogadores aparece 2x nas escolhas e lidera", () => {
    const r = [["a", "Funk"], ["b", "Funk"], ["c", "Pop"]].reduce(
      (acc, [id, g]) => voteGenres(acc, id, [g as never]),
      startGenreVote(joinRoom(lobby(), { id: "c", name: "Duda", avatar: 3 }), "a", 0, 1000),
    );
    expect(genrePicks(r).filter((g) => g === "Funk")).toHaveLength(2);
    expect(tallyGenres(r)[0]).toEqual({ genre: "Funk", votes: 2 });
    expect(closeGenreVote(r).topGenres).toEqual(["Funk", "Pop"]);
  });
  it("votos antigos com vários gêneros valem só o primeiro", () => {
    const r = { ...voting(), votes: { a: ["Funk", "Pop", "Rock"] as never } };
    expect(genrePicks(r)).toEqual(["Funk"]);
  });
  it("sem votos não escolhe nada (quem monta a partida sorteia)", () => {
    expect(closeGenreVote(voting()).topGenres).toEqual([]);
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

describe("contagem regressiva antes da música", () => {
  const voting = () => startGenreVote(lobby(), "a", 0, 1);
  const withCountdown = (countdownMs: number) => {
    const round = buildRound(0, track(1), distractors, 4000, 10_000, () => 0, countdownMs);
    return startRound(closeGenreVote(voting()), round);
  };

  it("buildRound guarda a duração da contagem (0 por padrão, como antes)", () => {
    expect(buildRound(0, track(1), distractors, 1000, 10_000, () => 0).countdownMs).toBe(0);
    expect(withCountdown(3000).round).toMatchObject({ startedAt: 4000, countdownMs: 3000 });
  });

  it("recusa resposta durante a contagem, mas tolera uma folga mínima de latência", () => {
    const r = withCountdown(3000); // "valendo" em t=4000
    expectCode(() => submitAnswer(r, "a", 1, 1000), "too_early");
    expectCode(() => submitAnswer(r, "a", 1, 4000 - EARLY_GRACE_MS - 1), "too_early");
    const ok = submitAnswer(r, "a", 1, 4000 - EARLY_GRACE_MS);
    expect(ok.round!.answers.a).toEqual({ choice: 1, elapsedMs: 0 }); // vale como resposta imediata, nunca negativa
  });

  it("o tempo de resposta e o limite contam a partir do 'valendo', não do início da contagem", () => {
    const r = withCountdown(3000);
    const answered = submitAnswer(r, "a", r.round!.correctIndex, 4000 + 1000);
    expect(answered.round!.answers.a.elapsedMs).toBe(1000);
    expect(closeRound(answered).players[0].score).toBe(930); // 1s de 10s, como sem contagem
    expectCode(() => submitAnswer(r, "b", 0, 4000 + 10_000 + 1), "time_over");
    expect(() => submitAnswer(r, "b", 0, 4000 + 10_000)).not.toThrow();
  });

  it("sem contagem (0) o comportamento é o de antes", () => {
    const r = withCountdown(0);
    expect(() => submitAnswer(r, "a", 0, 4000)).not.toThrow();
    expectCode(() => submitAnswer(r, "b", 0, 4000 - EARLY_GRACE_MS - 1), "too_early");
  });
});

describe("countdownStep", () => {
  it("divide a contagem em 3, 2, 1 de tempos iguais", () => {
    expect([3000, 2500, 2001].map((ms) => countdownStep(ms, 3000))).toEqual([3, 3, 3]);
    expect([2000, 1500, 1001].map((ms) => countdownStep(ms, 3000))).toEqual([2, 2, 2]);
    expect([1000, 500, 1].map((ms) => countdownStep(ms, 3000))).toEqual([1, 1, 1]);
  });
  it("acabou ou sem contagem = null", () => {
    expect(countdownStep(0, 3000)).toBeNull();
    expect(countdownStep(-50, 3000)).toBeNull();
    expect(countdownStep(1000, 0)).toBeNull();
  });
  it("funciona com tempos menores (ex.: testes) e nunca passa de 3", () => {
    expect([1500, 1000, 500].map((ms) => countdownStep(ms, 1500))).toEqual([3, 2, 1]);
    expect(countdownStep(9000, 3000)).toBe(3);
  });
});
