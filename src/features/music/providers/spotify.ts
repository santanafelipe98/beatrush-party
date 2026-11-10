import { MusicProviderError, type MusicProvider } from "../provider";

/**
 * Esqueleto do adaptador Spotify (ainda não implementado).
 * Pontos de atenção documentados em docs/04-music-providers.md:
 * - Client Credentials (servidor) para busca/recomendações;
 * - `preview_url` foi descontinuado para muitos apps, então o áudio provavelmente
 *   exigirá o Web Playback SDK (Premium) no Host.
 */
export function createSpotifyProvider(): MusicProvider {
  return {
    id: "spotify",
    async getTracksByGenre() {
      throw new MusicProviderError("Spotify ainda não implementado", "spotify");
    },
  };
}
