import { createDeezerProvider } from "./providers/deezer";
import { createMockProvider } from "./providers/mock";
import { createSpotifyProvider } from "./providers/spotify";
import type { MusicProvider } from "./provider";

export * from "./provider";
export * from "./select-round-tracks";
export { createDeezerProvider, createMockProvider, createSpotifyProvider };

/** Escolhe o adaptador via `MUSIC_PROVIDER` (deezer | spotify | mock). Padrão: deezer. */
export function createMusicProvider(name = process.env.MUSIC_PROVIDER ?? "deezer"): MusicProvider {
  switch (name) {
    case "mock":
      return createMockProvider();
    case "spotify":
      return createSpotifyProvider();
    case "deezer":
      return createDeezerProvider();
    default:
      throw new Error(`MUSIC_PROVIDER desconhecido: ${name}`);
  }
}
