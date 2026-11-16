// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GoogleAnalytics, parseGaId } from "./google-analytics";

describe("parseGaId", () => {
  it("aceita IDs do GA4 e ignora espaços", () => {
    expect(parseGaId("G-ABC123XYZ9")).toBe("G-ABC123XYZ9");
    expect(parseGaId("  G-ABC123XYZ9\n")).toBe("G-ABC123XYZ9");
  });
  it("rejeita vazio, ausente, formato errado e tentativa de injeção", () => {
    for (const bad of [undefined, "", "  ", "UA-12345-1", "g-abc123", "G-", "G-AB", "G-ABC123');alert(1);//", "G-ABC 123", "<script>"])
      expect(parseGaId(bad), String(bad)).toBeNull();
  });
});

describe("GoogleAnalytics", () => {
  it("sem ID não renderiza nada", () => {
    expect(GoogleAnalytics({ id: null })).toBeNull();
    const { container } = render(<GoogleAnalytics id={null} />);
    expect(container.innerHTML).toBe("");
  });
  it("com ID monta o script do gtag e a inicialização com o mesmo ID", () => {
    const el = GoogleAnalytics({ id: "G-ABC123XYZ9" })!;
    const [loader, init] = (el.props as { children: { props: Record<string, unknown> }[] }).children;
    expect(loader.props.src).toBe("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9");
    expect(String(init.props.children)).toContain("gtag('config','G-ABC123XYZ9')");
  });
});
