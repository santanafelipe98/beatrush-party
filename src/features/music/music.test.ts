import { describe, expect, it, vi } from "vitest";
import {
  MusicProviderError,
  createDeezerProvider,
  createMockProvider,
  createMusicProvider,
  selectRoundTracks,
} from "./index";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("Deezer provider", () => {
  const data = [
    { id: 1, title: "A", preview: "http://p/1.mp3", artist: { name: "X" }, album: { cover_medium: "c1" } },
    { id: 2, title: "B", preview: "", artist: { name: "Y" } },
    { id: 3, title: "C", preview: "http://p/3.mp3", artist: { name: "Z" } },
  ];

  it("mapeia faixas e descarta as sem preview", async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse({ data }));
    const tracks = await createDeezerProvider(fetchMock as never).getTracksByGenre("Pop", 5);
    expect(tracks.map((t) => t.id)).toEqual(["deezer-1", "deezer-3"]);
    expect(tracks[0]).toMatchObject({ title: "A", artist: "X", previewUrl: "http://p/1.mp3", coverUrl: "c1" });
    expect(String(fetchMock.mock.calls[0][0])).toContain("api.deezer.com/search?q=");
  });
  it("lança MusicProviderError em HTTP e payload inválidos", async () => {
    const bad = createDeezerProvider((async () => jsonResponse({}, false, 500)) as never);
    await expect(bad.getTracksByGenre("Pop", 3)).rejects.toBeInstanceOf(MusicProviderError);
    const err = createDeezerProvider((async () => jsonResponse({ error: { code: 4 } })) as never);
    await expect(err.getTracksByGenre("Pop", 3)).rejects.toThrow("resposta inválida");
  });
});

describe("factory", () => {
  it("resolve adaptadores e rejeita desconhecidos", () => {
    expect(createMusicProvider("mock").id).toBe("mock");
    expect(createMusicProvider("deezer").id).toBe("deezer");
    expect(createMusicProvider("spotify").id).toBe("spotify");
    expect(() => createMusicProvider("napster")).toThrow();
  });
  it("spotify ainda falha de forma explícita", async () => {
    await expect(createMusicProvider("spotify").getTracksByGenre("Pop", 1)).rejects.toBeInstanceOf(
      MusicProviderError,
    );
  });
});

describe("selectRoundTracks", () => {
  it("devolve N rodadas com 3 distratores distintos e sem repetir faixas", async () => {
    const rounds = await selectRoundTracks(createMockProvider(), ["Pop", "Rock", "Funk"], 12, () => 0.3);
    expect(rounds).toHaveLength(12);
    expect(new Set(rounds.map((r) => r.track.id)).size).toBe(12);
    for (const r of rounds) {
      expect(r.distractors).toHaveLength(3);
      expect(r.distractors.map((d) => d.id)).not.toContain(r.track.id);
      expect(new Set(r.distractors.map((d) => d.title)).size).toBe(3);
    }
  });
  it("falha quando o catálogo é pequeno demais", async () => {
    const tiny = { id: "t", getTracksByGenre: async () => [] };
    await expect(selectRoundTracks(tiny, ["Pop"], 3)).rejects.toThrow("catálogo insuficiente");
  });
});
