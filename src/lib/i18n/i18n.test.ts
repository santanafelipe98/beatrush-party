import { describe, expect, it } from "vitest";
import { GENRES } from "@/features/game";
import { errorMessageKey } from "@/features/realtime/client/errors";
import { LOCALES, negotiateLocale, isLocale } from "./locales";
import { MESSAGES } from "./messages";
import { createTranslator, interpolate } from "./translate";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("negotiateLocale", () => {
  it("usa o padrão sem cabeçalho", () => {
    expect(negotiateLocale(undefined)).toBe("pt-BR");
    expect(negotiateLocale("")).toBe("pt-BR");
  });
  it("mapeia variantes regionais", () => {
    expect(negotiateLocale("pt-PT")).toBe("pt-BR");
    expect(negotiateLocale("en-GB")).toBe("en");
    expect(negotiateLocale("es-MX")).toBe("es");
  });
  it("respeita os pesos q e ignora q=0", () => {
    expect(negotiateLocale("fr;q=0.9, en;q=0.8, es;q=0.7")).toBe("en");
    expect(negotiateLocale("es;q=0.4, en;q=0.9")).toBe("en");
    expect(negotiateLocale("en;q=0, es;q=0.5")).toBe("es");
  });
  it("idioma não suportado cai no padrão", () => {
    expect(negotiateLocale("fr-FR, de;q=0.8")).toBe("pt-BR");
  });
  it("isLocale valida", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("dicionários", () => {
  const base = MESSAGES["pt-BR"];
  const keys = Object.keys(base);

  it.each(LOCALES)("%s tem exatamente as mesmas chaves do idioma-fonte", (locale) => {
    expect(Object.keys(MESSAGES[locale]).sort()).toEqual([...keys].sort());
  });

  it.each(LOCALES)("%s não tem textos vazios e mantém os mesmos placeholders", (locale) => {
    for (const key of keys) {
      const value = MESSAGES[locale][key as keyof typeof base];
      expect(value.trim(), `${locale}:${key}`).not.toBe("");
      expect(placeholders(value), `${locale}:${key}`).toEqual(placeholders(base[key as keyof typeof base]));
    }
  });

  it("todo gênero do jogo e todo erro do servidor tem tradução", () => {
    for (const g of GENRES) expect(keys).toContain(`genre.${g}`);
    for (const code of ["room_not_found", "room_full", "name_taken", "wrong_phase", "not_host", "time_over"])
      expect(keys).toContain(`error.${code}`);
  });
});

describe("tradutor", () => {
  it("interpola e preserva placeholders desconhecidos", () => {
    expect(interpolate("Olá {name}, {n}!", { name: "Ana", n: 3 })).toBe("Olá Ana, 3!");
    expect(interpolate("Olá {name}", {})).toBe("Olá {name}");
    expect(interpolate("sem params")).toBe("sem params");
  });
  it("traduz por idioma", () => {
    expect(createTranslator("pt-BR").t("home.create")).toBe("Criar Nova Sala");
    expect(createTranslator("en").t("home.create")).toBe("Create New Room");
    expect(createTranslator("es").t("home.create")).toBe("Crear Nueva Sala");
    expect(createTranslator("es").t("lobby.connected", { count: 3, max: 8 })).toBe("3 / 8 conectados");
  });
  it("gêneros são traduzidos só na exibição", () => {
    expect(createTranslator("en").t("genre.Anos 80")).toBe("80s");
    expect(createTranslator("es").t("genre.Eletrônica")).toBe("Electrónica");
  });
  it("formata números conforme o idioma", () => {
    expect(createTranslator("pt-BR").n(1840)).toBe("1.840");
    expect(createTranslator("en").n(1840)).toBe("1,840");
    expect(createTranslator("pt-BR").n(1.2, { minimumFractionDigits: 1 })).toBe("1,2");
    expect(createTranslator("en").n(1.2, { minimumFractionDigits: 1 })).toBe("1.2");
  });
  it("ordinais", () => {
    const en = createTranslator("en").ordinal;
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(en)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
    expect(createTranslator("pt-BR").ordinal(2)).toBe("2º");
    expect(createTranslator("es").ordinal(3)).toBe("3º");
  });
});

describe("errorMessageKey", () => {
  it("mapeia códigos conhecidos e cai no fallback", () => {
    expect(errorMessageKey("room_full")).toBe("error.room_full");
    expect(errorMessageKey("algo_novo")).toBe("error.fallback");
  });
});
