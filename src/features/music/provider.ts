import type { Genre, Track } from "@/features/game";

/**
 * Porta (hexagonal) para qualquer catálogo de músicas.
 * O jogo só conhece esta interface; Deezer, Spotify ou Mock são adaptadores.
 */
export interface MusicProvider {
  readonly id: string;
  /** Faixas de um gênero. Só devem voltar faixas com `previewUrl` tocável. */
  getTracksByGenre(genre: Genre, limit: number): Promise<Track[]>;
}

export class MusicProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
  ) {
    super(message);
    this.name = "MusicProviderError";
  }
}
