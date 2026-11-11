// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageSwitcher } from "@/components/ui";
import { JoinForm } from "@/features/controller/components/join-form";
import { ResultScreen } from "@/features/controller/components/result-screen";
import { WaitingScreen } from "@/features/controller/components/waiting-screen";
import { RevealScreen } from "@/features/host/components/reveal-screen";
import type { RoomView } from "@/features/realtime/protocol";
import { LOCALE_COOKIE, type Locale } from "./locales";
import { I18nProvider, useI18n } from "./provider";

afterEach(() => {
  cleanup();
  document.cookie = `${LOCALE_COOKIE}=; path=/; max-age=0`;
  document.documentElement.lang = "";
});

const wrap = (locale: Locale, ui: React.ReactNode) => render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);

const player = (id: string, name: string, score = 0) => ({
  id, name, avatar: 1, connected: true, score, streak: 0, bestStreak: 3, correct: 9,
});
const view = (over: Partial<RoomView> = {}): RoomView => ({
  code: "BEAT", phase: "lobby", hostPlayerId: "a",
  players: [player("a", "Ana"), player("b", "Bob")],
  voteEndsAt: null, votedIds: [], topGenres: [], totalRounds: 12, roundsPlayed: 0,
  round: null, replayVotes: [], serverNow: Date.now(), ...over,
});

function Probe() {
  const { t, locale } = useI18n();
  return <p data-testid="probe">{locale}:{t("home.create")}</p>;
}

describe("LanguageSwitcher + provider", () => {
  it("troca o idioma, grava o cookie e atualiza <html lang>", () => {
    wrap("pt-BR", <><LanguageSwitcher /><Probe /></>);
    expect(screen.getByTestId("probe").textContent).toBe("pt-BR:Criar Nova Sala");
    expect(screen.getByRole("button", { name: "Português (Brasil)" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByTestId("probe").textContent).toBe("en:Create New Room");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=en`);
    expect(document.documentElement.lang).toBe("en");

    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(screen.getByTestId("probe").textContent).toBe("es:Crear Nueva Sala");
  });

  it("o grupo tem nome acessível no idioma atual", () => {
    wrap("es", <LanguageSwitcher />);
    expect(screen.getByRole("group", { name: "Idioma" })).toBeTruthy();
  });
});

describe("telas em outros idiomas", () => {
  it("formulário de entrada em inglês", () => {
    wrap("en", <JoinForm onSubmit={() => {}} error="Room not found." />);
    expect(screen.getByRole("button", { name: "Join Game" })).toBeTruthy();
    expect(screen.getByPlaceholderText("What do they call you?")).toBeTruthy();
    expect(screen.getByLabelText("Avatar 3")).toBeTruthy();
  });
  it("tela de espera em espanhol", () => {
    wrap("es", <WaitingScreen view={view()} playerId="b" onStart={() => {}} />);
    expect(screen.getByText("¡Ya estás dentro!")).toBeTruthy();
    expect(screen.getByText("Sala BEAT · Jugadores: 2")).toBeTruthy();
    expect(screen.getByText("Esperando que el anfitrión inicie…")).toBeTruthy();
  });
  it("resultado em inglês usa ordinal e milhar em inglês", () => {
    const v = view({ phase: "finished", players: [player("a", "Ana", 1840), player("b", "Bob", 2110)] });
    wrap("en", <ResultScreen view={v} playerId="a" onReplay={() => {}} />);
    expect(screen.getByTestId("my-place").textContent).toBe("2nd");
    expect(screen.getByText("You finished 2nd!")).toBeTruthy();
    expect(screen.getByText(/1,840/)).toBeTruthy();
  });
  it("revelação formata o tempo com o separador do idioma", () => {
    const v = view({
      phase: "reveal",
      round: {
        index: 0, options: [], startedAt: 0, durationMs: 10_000, answeredIds: ["a"],
        reveal: { correctIndex: 0, title: "T", artist: "A", results: { a: { correct: true, points: 980, elapsedMs: 1200 } } },
      },
    });
    const { unmount } = wrap("en", <RevealScreen view={v} />);
    expect(screen.getByText("1.2s")).toBeTruthy();
    unmount();
    wrap("pt-BR", <RevealScreen view={v} />);
    expect(screen.getByText("1,2s")).toBeTruthy();
  });
});
