import type { Track } from "@/features/game";
import { MusicProviderError, type MusicProvider } from "../provider";
import { DEEZER_SOURCES, sourcePath } from "./deezer-catalog";

interface DeezerTrack {
  id: number;
  title: string;
  preview?: string;
  artist: { name: string };
  album?: { cover_medium?: string };
}

const ID_PREFIX = "deezer-";

function toTrack(t: DeezerTrack): Track {
  return {
    id: `${ID_PREFIX}${t.id}`,
    title: t.title,
    artist: t.artist.name,
    previewUrl: t.preview,
    coverUrl: t.album?.cover_medium,
  };
}

export function createDeezerProvider(
  fetchImpl: typeof fetch = fetch,
  baseUrl = "https://api.deezer.com",
): MusicProvider {
  return {
    id: "deezer",
    async getTracksByGenre(genre, limit) {
      // pedimos mais do que o necessário porque nem toda faixa tem preview
      const url = `${baseUrl}${sourcePath(DEEZER_SOURCES[genre])}?limit=${limit * 3}`;
      const res = await fetchImpl(url);
      if (!res.ok) throw new MusicProviderError(`HTTP ${res.status}`, "deezer");
      const body = (await res.json()) as { data?: DeezerTrack[]; error?: unknown };
      if (body.error || !Array.isArray(body.data))
        throw new MusicProviderError("resposta inválida", "deezer");
      return body.data
        .filter((t) => !!t.preview)
        .slice(0, limit)
        .map(toTrack);
    },

    async getTrack(id) {
      if (!id.startsWith(ID_PREFIX)) return null; // faixa de outro catálogo (ex.: mock de fallback)
      const numeric = id.slice(ID_PREFIX.length);
      if (!/^\d+$/.test(numeric)) return null;
      const res = await fetchImpl(`${baseUrl}/track/${numeric}`);
      if (!res.ok) throw new MusicProviderError(`HTTP ${res.status}`, "deezer");
      const body = (await res.json()) as Partial<DeezerTrack> & { error?: unknown };
      // faixa removida: o Deezer responde 200 com { error: ... }
      if (body.error || !body.id || !body.artist) return null;
      return toTrack(body as DeezerTrack);
    },
  };
}
