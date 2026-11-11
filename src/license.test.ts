import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEEZER_LOGO_SRC } from "@/components/ui/deezer-logo";

const root = process.cwd();
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

/** Mantém os arquivos legais consistentes entre si e com o código (ex.: se o logo mudar de lugar). */
describe("licença e avisos de terceiros", () => {
  it("LICENSE é a MIT com ano e titular", () => {
    const text = read("LICENSE");
    expect(text.startsWith("MIT License")).toBe(true);
    expect(text).toMatch(/Copyright \(c\) 2026 Felipe Santana/);
    expect(text).toMatch(/THE SOFTWARE IS PROVIDED "AS IS"/);
  });

  it("package.json declara a mesma licença", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.license).toBe("MIT");
  });

  it("NOTICE aponta para o arquivo do logo que o app realmente usa", () => {
    const logoPath = "public" + decodeURIComponent(DEEZER_LOGO_SRC);
    expect(existsSync(path.join(root, logoPath))).toBe(true);
    expect(read("NOTICE")).toContain(logoPath);
  });

  it("NOTICE deixa claro o que a MIT não cobre e a restrição não comercial do Deezer", () => {
    const notice = read("NOTICE");
    expect(notice).toMatch(/NÃO estão cobertos pela licença MIT/);
    expect(notice).toMatch(/NÃO COMERCIAIS/);
    expect(notice).toMatch(/não é detentor desses direitos/);
    expect(notice).toMatch(/não implica afiliação, patrocínio ou\s+endosso/);
  });

  it("README tem a seção de licença e aponta LICENSE e NOTICE", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/## Licença/);
    expect(readme).toContain("(LICENSE)");
    expect(readme).toContain("(NOTICE)");
    expect(readme).toMatch(/fins não comerciais/);
  });
});
