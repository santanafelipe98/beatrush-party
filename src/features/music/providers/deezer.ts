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
        .map<Track>((t) => ({
          id: `deezer-${t.id}`,
          title: t.title,
          artist: t.artist.name,
          previewUrl: t.preview,
          coverUrl: t.album?.cover_medium,
        }));
    },
  };
}
