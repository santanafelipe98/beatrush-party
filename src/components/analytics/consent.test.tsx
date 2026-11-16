// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AboutDialog } from "@/components/ui/about-dialog";
import { I18nProvider } from "@/lib/i18n/provider";
import { AnalyticsProvider } from "./analytics-provider";
import { CONSENT_KEY, getConsent, resetConsent } from "./consent";
import { clearGaCookies } from "./google-analytics";

// next/script não roda no jsdom: troca por <script> simples para podermos ver o que seria carregado
vi.mock("next/script", () => ({
  default: (p: { src?: string; id?: string; children?: string }) => (
    <script data-testid={p.id ?? "gtag-src"} data-src={p.src}>{p.children}</script>
  ),
}));

const ID = "G-ABC123XYZ9";
const ui = (gaId: string | null, locale: "pt-BR" | "en" | "es" = "pt-BR") => (
  <I18nProvider initialLocale={locale}>
    <AnalyticsProvider gaId={gaId}>
      <AboutDialog />
    </AnalyticsProvider>
  </I18nProvider>
);
const loaded = () => document.querySelector('[data-testid="gtag-src"]') !== null;

beforeEach(() => {
  // jsdom ainda não implementa showModal/close do <dialog>
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  localStorage.clear();
  act(() => resetConsent());
  delete (window as unknown as Record<string, unknown>)[`ga-disable-${ID}`];
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("banner de consentimento", () => {
  it("sem ID do GA não mostra banner nem carrega nada", () => {
    render(ui(null));
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(loaded()).toBe(false);
  });

  it("primeira visita: mostra o banner e NÃO carrega o GA antes da escolha", () => {
    render(ui(ID));
    expect(screen.getByTestId("consent-banner")).toBeTruthy();
    expect(within(screen.getByTestId("consent-banner")).getByText(/Google Analytics/)).toBeTruthy();
    expect(loaded()).toBe(false);
    expect((window as unknown as Record<string, boolean>)[`ga-disable-${ID}`]).toBe(true);
  });

  it("aceitar: carrega o GA com o ID, guarda a escolha e some com o banner", () => {
    render(ui(ID));
    fireEvent.click(screen.getByTestId("consent-accept"));
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(document.querySelector('[data-testid="gtag-src"]')?.getAttribute("data-src")).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${ID}`,
    );
    expect(document.querySelector('[data-testid="ga-init"]')?.textContent).toContain(`gtag('config','${ID}')`);
    expect(localStorage.getItem(CONSENT_KEY)).toBe("granted");
    expect((window as unknown as Record<string, boolean>)[`ga-disable-${ID}`]).toBe(false);
  });

  it("recusar: nada é carregado, a escolha é guardada e o banner não volta", () => {
    const { unmount } = render(ui(ID));
    fireEvent.click(screen.getByTestId("consent-reject"));
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(loaded()).toBe(false);
    expect(localStorage.getItem(CONSENT_KEY)).toBe("denied");
    unmount();
    render(ui(ID)); // volta ao app
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(loaded()).toBe(false);
  });

  it("quem já aceitou antes carrega o GA direto, sem banner", () => {
    localStorage.setItem(CONSENT_KEY, "granted"); // escolha de uma visita anterior
    render(ui(ID));
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(loaded()).toBe(true);
  });

  it("aceitar e recusar têm o mesmo destaque (mesmas classes de botão)", () => {
    render(ui(ID));
    expect(screen.getByTestId("consent-accept").className).toBe(screen.getByTestId("consent-reject").className);
  });

  it("valor inválido no armazenamento é tratado como sem escolha", () => {
    localStorage.setItem(CONSENT_KEY, "talvez");
    expect(getConsent()).toBeNull();
  });

  it("localStorage bloqueado: a escolha vale na sessão e nada quebra", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(ui(ID));
    fireEvent.click(screen.getByTestId("consent-accept"));
    expect(screen.queryByTestId("consent-banner")).toBeNull();
    expect(loaded()).toBe(true);
  });

  it("textos em inglês e espanhol", () => {
    render(ui(ID, "en"));
    expect(screen.getByRole("region", { name: "Privacy notice" })).toBeTruthy();
    expect(screen.getByTestId("consent-accept").textContent).toBe("Accept");
    expect(screen.getByTestId("consent-reject").textContent).toBe("Decline");
    cleanup();
    render(ui(ID, "es"));
    expect(screen.getByTestId("consent-accept").textContent).toBe("Aceptar");
    expect(screen.getByTestId("consent-reject").textContent).toBe("Rechazar");
  });
});

describe("revogar / mudar de ideia", () => {
  it("'Preferências de privacidade' no Sobre reabre o banner e interrompe o GA", () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    render(ui(ID));
    expect(loaded()).toBe(true);

    fireEvent.click(screen.getByTestId("privacy-prefs"));
    expect(screen.getByTestId("consent-banner")).toBeTruthy();
    expect(loaded()).toBe(false);
    expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
    expect((window as unknown as Record<string, boolean>)[`ga-disable-${ID}`]).toBe(true);
  });

  it("o Sobre só mostra a seção de privacidade quando o Analytics está ativo", () => {
    render(ui(null));
    expect(screen.queryByTestId("privacy-prefs")).toBeNull();
    cleanup();
    render(ui(ID));
    expect(screen.getByTestId("privacy-prefs")).toBeTruthy();
  });

  it("recusar apaga os cookies do GA (_ga, _ga_*, _gid) e preserva os demais", () => {
    document.cookie = "_ga=GA1.1.1; path=/";
    document.cookie = "_ga_ABC123=GS1; path=/";
    document.cookie = "_gid=x; path=/";
    document.cookie = "beatrush-locale=en; path=/";
    render(ui(ID));
    fireEvent.click(screen.getByTestId("consent-reject"));
    expect(document.cookie).not.toMatch(/_ga|_gid/);
    expect(document.cookie).toContain("beatrush-locale=en");
    clearGaCookies(); // idempotente
  });
});
