import type { Genre } from "@/features/game";

/**
 * Fonte curada de cada gênero do jogo no Deezer (API pública, sem chave).
 * - `chart`: faixas mais populares de um gênero oficial (`GET /genre` lista os ids).
 * - `radio`: rádio temática, usada quando não existe gênero oficial (ex.: Anos 80).
 *
 * Para trocar ou adicionar uma fonte, basta editar este mapa.
 */
export type DeezerSource = { type: "chart"; id: number } | { type: "radio"; id: number };

export const DEEZER_SOURCES: Record<Genre, DeezerSource> = {
  Pop: { type: "chart", id: 132 },
  Rock: { type: "chart", id: 152 },
  "Hip-Hop": { type: "chart", id: 116 }, // Rap/Hip Hop
  "Anos 80": { type: "radio", id: 38305 },
  Sertanejo: { type: "chart", id: 80 },
  Funk: { type: "chart", id: 472 }, // Rap/Funk Brasileiro
  MPB: { type: "chart", id: 78 },
  Eletrônica: { type: "chart", id: 106 }, // Electro
};

export function sourcePath(source: DeezerSource): string {
  return source.type === "chart" ? `/chart/${source.id}/tracks` : `/radio/${source.id}/tracks`;
}
