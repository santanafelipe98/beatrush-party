import type { Genre, Track } from "@/features/game";
import { MusicProviderError, type MusicProvider } from "../provider";

/** Consulta de busca por gênero (a API pública do Deezer não exige chave). */
export const DEEZER_QUERIES: Record<Genre, string> = {
  Pop: 'genre:"pop"',
  Rock: 'genre:"rock"',
  "Hip-Hop": 'genre:"rap/hip hop"',
  "Anos 80": "anos 80 hits 1980s",
  Sertanejo: "sertanejo",
  Funk: "funk brasil",
  MPB: "mpb",
  Eletrônica: 'genre:"electro"',
};

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
      const url = `${baseUrl}/search?q=${encodeURIComponent(DEEZER_QUERIES[genre])}&limit=${limit * 3}`;
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
