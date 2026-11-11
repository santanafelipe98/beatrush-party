import { afterEach, describe, expect, it, vi } from "vitest";
import { uuid } from "./uuid";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe("uuid", () => {
  it("usa crypto.randomUUID quando existe", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "fixo" });
    expect(uuid()).toBe("fixo");
  });
  it("sem randomUUID (contexto inseguro) usa getRandomValues e gera v4 válido", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (a: Uint8Array) => a.fill(255),
    });
    expect(uuid()).toMatch(V4);
  });
  it("sem crypto algum ainda gera v4 válido e distinto", () => {
    vi.stubGlobal("crypto", undefined);
    const a = uuid();
    expect(a).toMatch(V4);
    expect(uuid()).not.toBe(a);
  });
});
