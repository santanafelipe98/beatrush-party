import type { Track } from "@/features/game";
import type { MusicProvider } from "@/features/music";
import type { TrackCache } from "./types";

/**
 * TTL padrão do cache de faixas. Os links de `preview` do Deezer são assinados e expiram em
 * ~14 min, então o cache precisa durar bem menos que isso para nunca servir um link vencido.
 */
export const TRACK_CACHE_TTL_SECONDS = 5 * 60;

/** Decorator: consulta o cache antes de chamar o provedor. Falha do cache nunca derruba o jogo. */
export function withTrackCache(
  provider: MusicProvider,
  cache: TrackCache,
  ttlSeconds = TRACK_CACHE_TTL_SECONDS,
  log: (message: string, error?: unknown) => void = (m, e) => console.warn(m, e ?? ""),
): MusicProvider {
  return {
    id: provider.id,
    async getTracksByGenre(genre, limit) {
      const key = `tracks:${provider.id}:${genre}:${limit}`;
      try {
        const hit = await cache.get<Track[]>(key);
        if (hit && hit.length > 0) return hit;
      } catch (e) {
        log("[cache] leitura falhou, indo ao provedor", e);
      }

      const tracks = await provider.getTracksByGenre(genre, limit);
      if (tracks.length > 0) {
        try {
          await cache.set(key, tracks, ttlSeconds);
        } catch (e) {
          log("[cache] gravação falhou", e);
        }
      }
      return tracks;
    },
  };
}
