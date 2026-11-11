import { describe, expect, it, vi } from "vitest";
import { GENRES } from "@/features/game";
import { DEEZER_SOURCES, sourcePath } from "./providers/deezer-catalog";
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
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse({ data }));
    const tracks = await createDeezerProvider(fetchMock as never).getTracksByGenre("Pop", 5);
    expect(tracks.map((t) => t.id)).toEqual(["deezer-1", "deezer-3"]);
    expect(tracks[0]).toMatchObject({ title: "A", artist: "X", previewUrl: "http://p/1.mp3", coverUrl: "c1" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.deezer.com/chart/132/tracks?limit=15");
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
    expect(() => createMusicProvider("napster")).toThrow("MUSIC_PROVIDER desconhecido");
    expect(() => createMusicProvider("spotify")).toThrow("MUSIC_PROVIDER desconhecido");
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

describe("catálogo de fontes do Deezer", () => {
  it("todo gênero do jogo tem uma fonte curada", () => {
    for (const g of GENRES) expect(DEEZER_SOURCES[g], g).toBeDefined();
  });
  it("monta o caminho de chart e de rádio", () => {
    expect(sourcePath({ type: "chart", id: 132 })).toBe("/chart/132/tracks");
    expect(sourcePath({ type: "radio", id: 38305 })).toBe("/radio/38305/tracks");
  });
  it("Anos 80 usa rádio e as demais usam chart oficial", async () => {
    const urls: string[] = [];
    const p = createDeezerProvider((async (u: string) => {
      urls.push(u);
      return jsonResponse({ data: [] });
    }) as never);
    await p.getTracksByGenre("Anos 80", 4);
    await p.getTracksByGenre("Funk", 4);
    expect(urls).toEqual([
      "https://api.deezer.com/radio/38305/tracks?limit=12",
      "https://api.deezer.com/chart/472/tracks?limit=12",
    ]);
  });
});

describe("Deezer getTrack (renovar link de preview)", () => {
  const body = {
    id: 3893226711,
    title: "Peão",
    preview: "https://cdn/preview-novo.mp3?hdnea=exp=999",
    artist: { name: "Jeninho" },
    album: { cover_medium: "https://cdn/capa.jpg" },
  };

  it("busca /track/{id} sem o prefixo e devolve o link atual", async () => {
    const f = vi.fn<(url: string) => Promise<Response>>(async () => jsonResponse(body));
    const track = await createDeezerProvider(f as never).getTrack!("deezer-3893226711");
    expect(f).toHaveBeenCalledWith("https://api.deezer.com/track/3893226711");
    expect(track).toEqual({
      id: "deezer-3893226711",
      title: "Peão",
      artist: "Jeninho",
      previewUrl: "https://cdn/preview-novo.mp3?hdnea=exp=999",
      coverUrl: "https://cdn/capa.jpg",
    });
  });

  it("ids de outros catálogos ou inválidos viram null sem chamar a API", async () => {
    const f = vi.fn();
    const p = createDeezerProvider(f as never);
    expect(await p.getTrack!("mock-1-2")).toBeNull();
    expect(await p.getTrack!("deezer-abc")).toBeNull();
    expect(await p.getTrack!("deezer-1/../x")).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("faixa removida (200 com error) vira null; erro HTTP lança", async () => {
    const gone = createDeezerProvider((async () => jsonResponse({ error: { code: 800 } })) as never);
    expect(await gone.getTrack!("deezer-1")).toBeNull();
    const down = createDeezerProvider((async () => jsonResponse({}, false, 503)) as never);
    await expect(down.getTrack!("deezer-1")).rejects.toBeInstanceOf(MusicProviderError);
  });
});
