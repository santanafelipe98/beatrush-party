// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "@/features/realtime/protocol";
import { AnswerPad } from "./answer-pad";

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const player = (id: string, name: string) => ({
  id, name, avatar: 1, connected: true, score: 0, streak: 0, bestStreak: 0, correct: 0,
});

const view = (toGoMs: number, countdownMs = 3000): RoomView => ({
  code: "BEAT",
  phase: "playing",
  hostPlayerId: "a",
  players: [player("a", "Ana"), player("b", "Bob")],
  voteEndsAt: null,
  votedIds: [],
  topGenres: [],
  totalRounds: 12,
  roundsPlayed: 2,
  round: {
    index: 2,
    options: [],
    startedAt: Date.now() + toGoMs,
    durationMs: 10_000,
    countdownMs,
    answeredIds: [],
  },
  replayVotes: [],
  serverNow: Date.now(),
  you: { playerId: "a", votes: null, answer: null },
});

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const buttons = () => [0, 1, 2, 3].map((i) => screen.getByTestId(`answer-${i}`) as HTMLButtonElement);

describe("celular: contagem 3-2-1", () => {
  it("durante a contagem os botões ficam travados e aparece o número", () => {
    const onAnswer = vi.fn();
    render(<AnswerPad view={view(3000)} playerId="a" onAnswer={onAnswer} />);
    expect(screen.getByTestId("pad-countdown").textContent).toBe("3");
    expect(buttons().every((b) => b.disabled)).toBe(true);
    expect(screen.getByText("Prepare-se!")).toBeTruthy();
    expect(screen.getByText("As respostas abrem quando a música começar")).toBeTruthy();
    buttons().forEach((b) => fireEvent.click(b));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("o tempo mostrado durante a contagem é a duração da rodada (não 0:13)", () => {
    render(<AnswerPad view={view(3000)} playerId="a" onAnswer={() => {}} />);
    expect(screen.getByText("0:10")).toBeTruthy();
    expect(screen.queryByText("0:13")).toBeNull();
  });

  it("conta 3, 2, 1 e então libera as respostas", () => {
    const onAnswer = vi.fn();
    render(<AnswerPad view={view(3000)} playerId="a" onAnswer={onAnswer} />);
    tick(1100);
    expect(screen.getByTestId("pad-countdown").textContent).toBe("2");
    tick(1000);
    expect(screen.getByTestId("pad-countdown").textContent).toBe("1");
    expect(buttons().every((b) => b.disabled)).toBe(true);

    tick(1000); // "valendo"
    expect(screen.queryByTestId("pad-countdown")).toBeNull();
    expect(buttons().every((b) => !b.disabled)).toBe(true);
    expect(screen.getByText("Toque na forma que aparece na TV")).toBeTruthy();
    fireEvent.click(buttons()[2]);
    expect(onAnswer).toHaveBeenCalledWith(2);
  });

  it("sem contagem (countdownMs 0) os botões já nascem liberados, como antes", () => {
    render(<AnswerPad view={view(0, 0)} playerId="a" onAnswer={() => {}} />);
    expect(screen.queryByTestId("pad-countdown")).toBeNull();
    expect(buttons().every((b) => !b.disabled)).toBe(true);
  });

  it("a contagem não bloqueia a revelação: na fase reveal nada de contagem", () => {
    const v = view(-5000);
    const reveal: RoomView = {
      ...v,
      phase: "reveal",
      round: { ...v.round!, reveal: { correctIndex: 1, title: "T", artist: "A", results: { a: { correct: true, points: 900, elapsedMs: 800 } } } },
    };
    render(<AnswerPad view={reveal} playerId="a" onAnswer={() => {}} />);
    expect(screen.queryByTestId("pad-countdown")).toBeNull();
    expect(screen.getByText("Acertou! +900")).toBeTruthy();
  });
});
