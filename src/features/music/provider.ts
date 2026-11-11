import type { Genre, Track } from "@/features/game";

/**
 * Porta (hexagonal) para qualquer catálogo de músicas.
 * O jogo só conhece esta interface; Deezer e Mock são adaptadores.
 */
export interface MusicProvider {
  readonly id: string;
  /** Faixas de um gênero. Só devem voltar faixas com `previewUrl` tocável. */
  getTracksByGenre(genre: Genre, limit: number): Promise<Track[]>;
  /**
   * Opcional. Busca UMA faixa pelo id para obter um `previewUrl` atual. Útil quando o link de
   * áudio é assinado e expira (Deezer: ~14 min). Devolve `null` se o id não é deste provedor ou
   * a faixa não existe mais; lança em erro de rede.
   */
  getTrack?(id: string): Promise<Track | null>;
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
