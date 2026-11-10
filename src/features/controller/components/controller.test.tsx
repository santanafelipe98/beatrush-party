// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "@/features/realtime/protocol";
import { AnswerPad } from "./answer-pad";
import { GenrePicker } from "./genre-picker";
import { JoinForm } from "./join-form";
import { ResultScreen } from "./result-screen";
import { WaitingScreen } from "./waiting-screen";

afterEach(cleanup);

const player = (id: string, name: string, score = 0, extra = {}) => ({
  id,
  name,
  avatar: 1,
  connected: true,
  score,
  streak: 0,
  bestStreak: 3,
  correct: 9,
  ...extra,
});

const view = (over: Partial<RoomView> = {}): RoomView => ({
  code: "BEAT",
  phase: "lobby",
  hostPlayerId: "a",
  players: [player("a", "Ana"), player("b", "Bob")],
  voteEndsAt: null,
  votedIds: [],
  topGenres: [],
  totalRounds: 12,
  roundsPlayed: 0,
  round: null,
  replayVotes: [],
  serverNow: Date.now(),
  ...over,
});

describe("JoinForm", () => {
  it("só habilita com código de 4 letras e nome; normaliza o código", () => {
    const onSubmit = vi.fn();
    render(<JoinForm onSubmit={onSubmit} />);
    const btn = screen.getByRole("button", { name: "Entrar no Jogo" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText("ABCD"), { target: { value: "be4at!x" } });
    fireEvent.change(screen.getByPlaceholderText("Como te chamam?"), { target: { value: "  Ana " } });
    expect(btn.disabled).toBe(false);
    fireEvent.click(screen.getByLabelText("Avatar 4"));
    fireEvent.click(btn);
    expect(onSubmit).toHaveBeenCalledWith({ code: "BEAT", name: "Ana", avatar: 3 });
  });
  it("preenche o código inicial e mostra erro", () => {
    render(<JoinForm initialCode="abcd" error="Sala não encontrada." onSubmit={() => {}} />);
    expect((screen.getByPlaceholderText("ABCD") as HTMLInputElement).value).toBe("ABCD");
    expect(screen.getByRole("alert").textContent).toContain("Sala não encontrada");
  });
});

describe("GenrePicker", () => {
  it("limita a 3 gêneros e envia", () => {
    const onSubmit = vi.fn();
    render(<GenrePicker voteEndsAt={Date.now() + 15_000} submitted={null} onSubmit={onSubmit} />);
    for (const g of ["Pop", "Rock", "Funk", "MPB"]) fireEvent.click(screen.getByRole("button", { name: g }));
    expect(screen.getByText("3 de 3 selecionados")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar Votos" }));
    expect(onSubmit).toHaveBeenCalledWith(["Pop", "Rock", "Funk"]);
  });
  it("trava depois de enviado", () => {
    render(<GenrePicker voteEndsAt={Date.now() + 5000} submitted={["Pop"]} onSubmit={() => {}} />);
    expect((screen.getByRole("button", { name: /^Pop/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Votos enviados ✓")).toBeTruthy();
  });
});

describe("AnswerPad", () => {
  const playing = (answer: number | null = null) =>
    view({
      phase: "playing",
      round: {
        index: 2,
        options: [],
        startedAt: Date.now(),
        durationMs: 10_000,
        answeredIds: answer === null ? [] : ["a"],
      },
      you: { playerId: "a", votes: null, answer },
    });

  it("responde ao tocar numa forma e então bloqueia", () => {
    const onAnswer = vi.fn();
    const { rerender } = render(<AnswerPad view={playing()} playerId="a" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByTestId("answer-1"));
    expect(onAnswer).toHaveBeenCalledWith(1);
    rerender(<AnswerPad view={playing(1)} playerId="a" onAnswer={onAnswer} />);
    expect((screen.getByTestId("answer-0") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Resposta enviada")).toBeTruthy();
  });

  const revealed = (answer: number | null, correct: boolean, points = 0) =>
    view({
      phase: "reveal",
      round: {
        index: 0,
        options: [],
        startedAt: 0,
        durationMs: 10_000,
        answeredIds: [],
        reveal: {
          correctIndex: 1,
          title: "T",
          artist: "A",
          results: { a: { correct, points, elapsedMs: answer === null ? null : 1200 } },
        },
      },
      you: { playerId: "a", votes: null, answer },
    });

  it("feedback de acerto, erro e sem resposta", () => {
    const { rerender } = render(<AnswerPad view={revealed(1, true, 980)} playerId="a" onAnswer={() => {}} />);
    expect(screen.getByText("Acertou! +980")).toBeTruthy();
    rerender(<AnswerPad view={revealed(0, false)} playerId="a" onAnswer={() => {}} />);
    expect(screen.getByText("Errou · +0")).toBeTruthy();
    rerender(<AnswerPad view={revealed(null, false)} playerId="a" onAnswer={() => {}} />);
    expect(screen.getByText("Sem resposta")).toBeTruthy();
  });
});

describe("WaitingScreen", () => {
  it("só o host com 2+ jogadores consegue iniciar", () => {
    const onStart = vi.fn();
    const { rerender } = render(<WaitingScreen view={view()} playerId="a" onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Seleção de Gêneros" }));
    expect(onStart).toHaveBeenCalledTimes(1);
    rerender(<WaitingScreen view={view()} playerId="b" onStart={onStart} />);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<WaitingScreen view={view({ players: [player("a", "Ana")] })} playerId="a" onStart={onStart} />);
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ResultScreen", () => {
  it("mostra colocação, pontos e permite votar revanche", () => {
    const onReplay = vi.fn();
    const v = view({
      phase: "finished",
      players: [player("a", "Ana", 1840), player("b", "Bob", 2110)],
    });
    render(<ResultScreen view={v} playerId="a" onReplay={onReplay} />);
    expect(screen.getByTestId("my-place").textContent).toBe("2º");
    expect(screen.getByText("Você ficou em 2º lugar!")).toBeTruthy();
    expect(screen.getByText(/75% de precisão/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Votar para Jogar de Novo" }));
    expect(onReplay).toHaveBeenCalled();
  });
});
