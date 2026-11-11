// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JoinForm } from "@/features/controller/components/join-form";
import { HomeScreen } from "@/features/home/components/home-screen";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/locales";
import { DEEZER_LOGO_SRC, DeezerLogo } from "./deezer-logo";

afterEach(cleanup);

const wrap = (locale: Locale, ui: React.ReactNode) => render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
const root = process.cwd();
const file = path.join(root, "public", decodeURIComponent(DEEZER_LOGO_SRC));

describe("DeezerLogo", () => {
  it("aponta para o arquivo local sem recodificar e mantém a proporção", () => {
    render(<DeezerLogo height={40} />);
    const img = screen.getByRole("img", { name: /deezer/i }) as HTMLImageElement;
    expect(new URL(img.src).pathname).toBe(DEEZER_LOGO_SRC); // servido direto de /public (unoptimized)
    expect(img.style.height).toBe("40px");
    expect(img.style.width).toBe("auto");
    expect(img.getAttribute("width")).toBe("2500");
    expect(img.getAttribute("height")).toBe("367");
    expect(img.draggable).toBe(false);
  });

  it.each(["pt-BR", "en", "es"] as const)("texto alternativo em %s é o texto da própria imagem", (locale) => {
    wrap(locale, <DeezerLogo />);
    expect(screen.getByRole("img", { name: "Powered by Deezer" })).toBeTruthy();
  });

  it("sem o arquivo (erro ao carregar) mostra só o texto 'Powered by Deezer', sem imagem quebrada", () => {
    render(<DeezerLogo height={36} />);
    fireEvent.error(screen.getByRole("img", { name: /deezer/i }));
    expect(screen.queryByRole("img")).toBeNull();
    const fallback = screen.getByTestId("deezer-logo");
    expect(fallback.tagName).toBe("SPAN");
    expect(fallback.textContent).toBe("Powered by Deezer");
    expect(fallback.style.height).toBe("36px");
  });
});

describe("presença do logo nas telas (exigência da API do Deezer)", () => {
  it("tela inicial", () => {
    render(<HomeScreen />);
    expect(screen.getByTestId("deezer-logo")).toBeTruthy();
  });
  it("formulário de entrada do celular", () => {
    render(<JoinForm onSubmit={() => {}} />);
    expect(screen.getByTestId("deezer-logo")).toBeTruthy();
  });
});

/**
 * O arquivo do logo é um Brand Asset do Deezer: os termos do Brand Hub proíbem repassá-lo a
 * terceiros sem autorização escrita. Por isso ele NÃO pode ser versionado nem publicado.
 */
describe("o logo do Deezer não é redistribuído com o código", () => {
  it(".gitignore ignora public/brand/", () => {
    expect(readFileSync(path.join(root, ".gitignore"), "utf8")).toMatch(/^\/public\/brand\/\s*$/m);
  });

  it("nenhum arquivo de public/brand/ está rastreado pelo git", () => {
    let tracked: string;
    try {
      tracked = execSync("git ls-files public/brand", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return; // fora de um checkout git (ex.: tarball): nada a verificar
    }
    expect(tracked, "arquivo de marca do Deezer rastreado pelo git").toBe("");
  });
});

// Só roda onde há uma cópia local do logo (cada operador usa a sua, autorizada pelo Deezer).
describe.skipIf(!existsSync(file))("cópia local do logo em public/brand/", () => {
  const svg = () => readFileSync(file, "utf8");

  it("é um SVG com as dimensões originais do kit (2500×367)", () => {
    expect(file.endsWith(".svg")).toBe(true);
    const s = svg();
    expect(s.trimStart().startsWith("<svg")).toBe(true);
    expect(s).toMatch(/viewBox="0 0 2500 367"/);
    expect(s).toMatch(/width="2500"/);
    expect(s).toMatch(/height="367"/);
  });

  it("é só desenho branco (sem fundo): depende de fundo escuro", () => {
    const fills = [...svg().matchAll(/fill="([^"]+)"/g)].map((m) => m[1]).filter((v) => v !== "none");
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills)).toEqual(new Set(["white"]));
  });

  it("é inerte: sem scripts, estilos, imagens embutidas nem referências externas", () => {
    expect(svg()).not.toMatch(/<script|<style|<image|<foreignObject|\bon\w+=|xlink:href|href=|url\(|@import/i);
  });
});
