// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JoinForm } from "@/features/controller/components/join-form";
import { HomeScreen } from "@/features/home/components/home-screen";
import { I18nProvider } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/locales";
import { DEEZER_LOGO_SRC, DeezerLogo } from "./deezer-logo";

afterEach(cleanup);

const wrap = (locale: Locale, ui: React.ReactNode) => render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);

describe("DeezerLogo", () => {
  it("usa o arquivo oficial sem recodificar e mantém a proporção", () => {
    render(<DeezerLogo height={40} />);
    const img = screen.getByRole("img", { name: /deezer/i }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(DEEZER_LOGO_SRC); // servido direto de /public (unoptimized)
    expect(img.style.height).toBe("40px");
    expect(img.style.width).toBe("auto");
    expect(img.getAttribute("width")).toBe("714");
    expect(img.getAttribute("height")).toBe("200");
    expect(img.draggable).toBe(false);
  });

  it.each([
    ["pt-BR", "Logotipo do Deezer"],
    ["en", "Deezer logo"],
    ["es", "Logotipo de Deezer"],
  ] as const)("texto alternativo em %s", (locale, alt) => {
    wrap(locale, <DeezerLogo />);
    expect(screen.getByRole("img", { name: alt })).toBeTruthy();
  });
});

describe("presença do logo nas telas (exigência da API do Deezer)", () => {
  it("tela inicial", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("img", { name: /deezer/i })).toBeTruthy();
  });
  it("formulário de entrada do celular", () => {
    render(<JoinForm onSubmit={() => {}} />);
    expect(screen.getByRole("img", { name: /deezer/i })).toBeTruthy();
  });
});

describe("arquivo do logo em public/", () => {
  const file = path.join(process.cwd(), "public", decodeURIComponent(DEEZER_LOGO_SRC));

  it("existe, é um PNG com transparência e tem as dimensões originais do kit (714×200)", () => {
    const b = readFileSync(file);
    expect(b.subarray(1, 4).toString()).toBe("PNG");
    expect(b.readUInt32BE(16)).toBe(714);
    expect(b.readUInt32BE(20)).toBe(200);
    expect(b[25]).toBe(6); // RGBA: o logo branco depende do canal alfa
  });
});
