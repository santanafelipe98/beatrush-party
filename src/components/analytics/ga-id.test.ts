import { describe, expect, it } from "vitest";
import { parseGaId } from "./ga-id";

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
