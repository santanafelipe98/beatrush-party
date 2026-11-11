import { createDeezerProvider } from "./providers/deezer";
import { createMockProvider } from "./providers/mock";
import type { MusicProvider } from "./provider";

export * from "./provider";
export * from "./select-round-tracks";
export { createDeezerProvider, createMockProvider };

/** Escolhe o adaptador via `MUSIC_PROVIDER` (deezer | mock). Padrão: deezer. */
export function createMusicProvider(name = process.env.MUSIC_PROVIDER ?? "deezer"): MusicProvider {
  switch (name) {
    case "mock":
      return createMockProvider();
    case "deezer":
      return createDeezerProvider();
    default:
      throw new Error(`MUSIC_PROVIDER desconhecido: ${name}`);
  }
}
