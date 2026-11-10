// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RoomView } from "@/features/realtime/protocol";
import { FinalScreen } from "./final-screen";
import { GenreVoteScreen } from "./genre-vote-screen";
import { LobbyScreen } from "./lobby-screen";
import { PlayingScreen } from "./playing-screen";
import { RevealScreen } from "./reveal-screen";

afterEach(cleanup);

const player = (id: string, name: string, score = 0, extra = {}) => ({
  id,
  name,
  avatar: 1,
  connected: true,
  score,
  streak: 0,
  bestStreak: 2,
  correct: 0,
  ...extra,
});

const base: RoomView = {
  code: "BEAT",
  phase: "lobby",
  hostPlayerId: "a",
  players: [player("a", "Ana"), player("b", "Carlos")],
  voteEndsAt: null,
  votedIds: [],
  topGenres: [],
  totalRounds: 12,
  roundsPlayed: 0,
  round: null,
  replayVotes: [],
  serverNow: Date.now(),
};

describe("telas do Host", () => {
  it("lobby mostra código, QR, jogadores e vagas livres", () => {
    render(<LobbyScreen view={base} joinUrl="http://x.test/play?code=BEAT" />);
    expect(screen.getByTestId("room-code").textContent).toBe("BEAT");
    expect(screen.getByRole("img", { name: /QR Code/ })).toBeTruthy();
    expect(screen.getByText("Ana (Host)")).toBeTruthy();
    expect(screen.getByText("2 / 8 conectados")).toBeTruthy();
    expect(screen.getAllByText("Aguardando…").length).toBeGreaterThan(0);
    expect(screen.getByText(/Ana pode iniciar/)).toBeTruthy();
  });

  it("lobby com 1 jogador pede mais gente", () => {
    render(<LobbyScreen view={{ ...base, players: [base.players[0]] }} joinUrl="http://x/play" />);
    expect(screen.getByText(/mín. 2/)).toBeTruthy();
  });

  it("votação exibe porcentagens e top 3", () => {
    const view: RoomView = {
      ...base,
      phase: "genre-vote",
      voteEndsAt: Date.now() + 10_000,
      votedIds: ["a"],
      tally: [
        { genre: "Pop", votes: 2 },
        { genre: "Rock", votes: 1 },
        { genre: "Funk", votes: 0 },
      ],
    };
    render(<GenreVoteScreen view={view} />);
    expect(screen.getByText("VOTOS 1/2")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText("#1 Pop", { selector: "span.rounded-full" })).toBeTruthy();
  });

  it("rodada mostra 4 opções e quantos já responderam", () => {
    const view: RoomView = {
      ...base,
      phase: "playing",
      round: {
        index: 2,
        options: ["A", "B", "C", "D"].map((t) => ({ title: `Song ${t}`, artist: "Art" })),
        startedAt: Date.now(),
        durationMs: 10_000,
        answeredIds: ["a"],
      },
    };
    render(<PlayingScreen view={view} />);
    expect(screen.getByText("Música 3")).toBeTruthy();
    expect([0, 1, 2, 3].map((i) => screen.getByTestId(`tv-option-${i}`))).toHaveLength(4);
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("revelação lista a resposta e os mais rápidos", () => {
    const view: RoomView = {
      ...base,
      phase: "reveal",
      round: {
        index: 0,
        options: [],
        startedAt: 0,
        durationMs: 10_000,
        answeredIds: ["a"],
        reveal: {
          correctIndex: 1,
          title: "Billie Jean",
          artist: "Michael Jackson",
          results: {
            a: { correct: true, points: 980, elapsedMs: 1200 },
            b: { correct: false, points: 0, elapsedMs: null },
          },
        },
      },
    };
    render(<RevealScreen view={view} />);
    expect(screen.getByTestId("reveal-title").textContent).toBe("Billie Jean");
    expect(screen.getByText("+980")).toBeTruthy();
    expect(screen.getByText("1,2s")).toBeTruthy();
  });

  it("revelação sem acertos avisa", () => {
    const view = {
      ...base,
      phase: "reveal",
      round: {
        index: 0,
        options: [],
        startedAt: 0,
        durationMs: 1,
        answeredIds: [],
        reveal: { correctIndex: 0, title: "T", artist: "A", results: {} },
      },
    } as RoomView;
    render(<RevealScreen view={view} />);
    expect(screen.getByText("Ninguém acertou dessa vez!")).toBeTruthy();
  });

  it("ranking final ordena por pontos", () => {
    const view: RoomView = {
      ...base,
      phase: "finished",
      players: [player("a", "Ana", 1840), player("b", "Carlos", 2110), player("c", "Gabi", 900)],
      replayVotes: ["a"],
    };
    render(<FinalScreen view={view} />);
    const rows = screen.getAllByTestId("ranking-row").map((r) => r.textContent);
    expect(rows[0]).toContain("Carlos");
    expect(rows[2]).toContain("Gabi");
    expect(screen.getByText(/1\/3 votos/)).toBeTruthy();
  });
});
