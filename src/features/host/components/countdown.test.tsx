// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RoomView } from "@/features/realtime/protocol";
import { HostAudio } from "./host-audio";
import { PlayingScreen } from "./playing-screen";

beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const player = (id: string, name: string) => ({
  id, name, avatar: 1, connected: true, score: 0, streak: 0, bestStreak: 0, correct: 0,
});

/** Rodada cujo "valendo" é daqui a `toGoMs`. */
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
    options: ["A", "B", "C", "D"].map((t) => ({ title: `Song ${t}`, artist: "Art" })),
    startedAt: Date.now() + toGoMs,
    durationMs: 10_000,
    countdownMs,
    answeredIds: [],
  },
  replayVotes: [],
  serverNow: Date.now(),
});

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe("TV: contagem 3-2-1 antes da música", () => {
  it("mostra 3, depois 2, depois 1, e só então a pergunta e as opções", () => {
    render(<PlayingScreen view={view(3000)} />);
    const num = () => screen.getByTestId("tv-countdown");

    expect(num().textContent).toBe("3");
    expect(screen.getByText("Prepare-se!")).toBeTruthy();
    expect(screen.queryByTestId("tv-option-0")).toBeNull(); // opções escondidas
    expect(screen.queryByText("Qual é a música?")).toBeNull();

    tick(1100);
    expect(num().textContent).toBe("2");
    tick(1000);
    expect(num().textContent).toBe("1");
    expect(screen.queryByTestId("tv-option-0")).toBeNull();

    tick(1000); // "valendo"
    expect(screen.queryByTestId("tv-countdown")).toBeNull();
    expect([0, 1, 2, 3].map((i) => screen.getByTestId(`tv-option-${i}`))).toHaveLength(4);
    expect(screen.getByText("Qual é a música?")).toBeTruthy();
  });

  it("o título mostra o número da rodada durante a contagem", () => {
    render(<PlayingScreen view={view(3000)} />);
    expect(screen.getByText("Música 3")).toBeTruthy();
    expect(screen.getByRole("timer", { name: "Começa em 3" })).toBeTruthy();
  });

  it("sem contagem (countdownMs 0) mostra a pergunta na hora, como antes", () => {
    render(<PlayingScreen view={view(0, 0)} />);
    expect(screen.queryByTestId("tv-countdown")).toBeNull();
    expect(screen.getByTestId("tv-option-0")).toBeTruthy();
  });

  it("a contagem se divide em 3 partes iguais mesmo quando o tempo é menor", () => {
    render(<PlayingScreen view={view(1500, 1500)} />);
    const seen: string[] = [screen.getByTestId("tv-countdown").textContent!];
    for (let i = 0; i < 3; i++) {
      tick(500);
      const el = screen.queryByTestId("tv-countdown");
      if (el) seen.push(el.textContent!);
    }
    expect(seen).toEqual(["3", "2", "1"]);
  });

  it("textos em inglês", async () => {
    const { I18nProvider } = await import("@/lib/i18n/provider");
    render(
      <I18nProvider initialLocale="en">
        <PlayingScreen view={view(3000)} />
      </I18nProvider>,
    );
    expect(screen.getByText("Get ready!")).toBeTruthy();
    expect(screen.getByRole("timer", { name: "Starts in 3" })).toBeTruthy();
  });
});

describe("HostAudio: a música só toca no 'valendo'", () => {
  let play: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.play = play as unknown as () => Promise<void>;
  });

  it("carrega o áudio mas só dá play em startAt", () => {
    const startAt = Date.now() + 3000;
    render(<HostAudio src="a.mp3" muted={false} startAt={startAt} />);
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("a.mp3"); // pré-carregando
    tick(2900);
    expect(play).not.toHaveBeenCalled();
    tick(150);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("converte o relógio do servidor com o offset (servidor 5 s à frente)", () => {
    const serverNow = Date.now() + 5000;
    render(<HostAudio src="a.mp3" muted={false} startAt={serverNow + 3000} clockOffset={5000} />);
    tick(2900);
    expect(play).not.toHaveBeenCalled();
    tick(150);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("sem startAt (ou no passado) toca na hora", () => {
    render(<HostAudio src="a.mp3" muted={false} />);
    expect(play).toHaveBeenCalledTimes(1);
    cleanup();
    play.mockClear();
    render(<HostAudio src="b.mp3" muted={false} startAt={Date.now() - 500} />);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("nova faixa antes do 'valendo' cancela o agendamento da anterior (sem tocar duas vezes)", () => {
    const { rerender } = render(<HostAudio src="a.mp3" muted={false} startAt={Date.now() + 3000} />);
    tick(1000);
    rerender(<HostAudio src="b.mp3" muted={false} startAt={Date.now() + 3000} />);
    tick(2500); // passaria do prazo da primeira faixa
    expect(play).not.toHaveBeenCalled();
    tick(600);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("atualização do offset do relógio NÃO reinicia a música em andamento", () => {
    const startAt = Date.now() + 1000;
    const { rerender } = render(<HostAudio src="a.mp3" muted={false} startAt={startAt} clockOffset={0} />);
    tick(1100);
    expect(play).toHaveBeenCalledTimes(1);
    const audio = document.querySelector("audio") as HTMLAudioElement;
    audio.currentTime = 7; // música já tocando
    rerender(<HostAudio src="a.mp3" muted={false} startAt={startAt} clockOffset={37} />);
    rerender(<HostAudio src="a.mp3" muted={false} startAt={startAt} clockOffset={-12} />);
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio.currentTime).toBe(7);
  });

  it("sem src não renderiza nada", () => {
    const { container } = render(<HostAudio muted={false} startAt={Date.now()} />);
    expect(container.innerHTML).toBe("");
  });
});
