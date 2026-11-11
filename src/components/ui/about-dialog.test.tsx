// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JoinForm } from "@/features/controller/components/join-form";
import { HomeScreen } from "@/features/home/components/home-screen";
import type { Locale } from "@/lib/i18n/locales";
import { I18nProvider } from "@/lib/i18n/provider";
import { AboutDialog } from "./about-dialog";

// jsdom ainda não implementa showModal/close do <dialog>
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

const wrap = (locale: Locale, ui: React.ReactNode) => render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("AboutDialog", () => {
  it("começa fechado e abre ao clicar em Sobre", () => {
    render(<AboutDialog />);
    expect(dialog().hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Sobre" }));
    expect(dialog().hasAttribute("open")).toBe(true);
    expect(screen.getByRole("dialog", { name: "Sobre o BeatRush Party" })).toBeTruthy();
  });

  it("fecha pelo botão Fechar e ao clicar no fundo, mas não ao clicar no conteúdo", () => {
    render(<AboutDialog />);
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Sobre" }));

    open();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(dialog().hasAttribute("open")).toBe(false);

    open();
    fireEvent.click(screen.getByText("Uso exclusivamente para fins não comerciais.")); // conteúdo
    expect(dialog().hasAttribute("open")).toBe(true);
    fireEvent.click(dialog()); // fundo (o próprio <dialog>)
    expect(dialog().hasAttribute("open")).toBe(false);
  });

  it("pt-BR: afirma que não detém direitos, não fornece conteúdo, consome do Deezer e é não comercial", () => {
    render(<AboutDialog />);
    const text = dialog().textContent!;
    expect(text).toMatch(/não é detentor dos direitos das músicas/);
    expect(text).toMatch(/não é fornecedor de conteúdo musical/);
    expect(text).toMatch(/apenas consome, por meio da API do Deezer/);
    expect(text).toMatch(/não armazena nem redistribui arquivos de áudio/);
    expect(text).toMatch(/não é afiliado, patrocinado nem endossado pelo Deezer/);
    expect(text).toMatch(/fins não comerciais/);
  });

  it("en: mesmas afirmações", () => {
    wrap("en", <AboutDialog />);
    const text = dialog().textContent!;
    expect(text).toMatch(/does not own the rights to the music/);
    expect(text).toMatch(/not a music content provider/);
    expect(text).toMatch(/only consumes, through the Deezer API/);
    expect(text).toMatch(/does not store or redistribute audio files/);
    expect(text).toMatch(/not affiliated with, sponsored by or endorsed by Deezer/);
    expect(text).toMatch(/non-commercial/);
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
  });

  it("es: mesmas afirmações", () => {
    wrap("es", <AboutDialog />);
    const text = dialog().textContent!;
    expect(text).toMatch(/no es titular de los derechos/);
    expect(text).toMatch(/ni es proveedora de contenido musical/);
    expect(text).toMatch(/Solo consume, a través de la API de Deezer/);
    expect(text).toMatch(/no almacena ni redistribuye archivos de audio/);
    expect(text).toMatch(/no está afiliada, patrocinada ni respaldada por Deezer/);
    expect(text).toMatch(/no comercial/);
    expect(screen.getByRole("button", { name: "Acerca de" })).toBeTruthy();
  });
});

describe("presença do aviso nas telas", () => {
  it("tela inicial", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("button", { name: "Sobre" })).toBeTruthy();
  });
  it("formulário de entrada do celular", () => {
    render(<JoinForm onSubmit={() => {}} />);
    expect(screen.getByRole("button", { name: "Sobre" })).toBeTruthy();
  });
});
