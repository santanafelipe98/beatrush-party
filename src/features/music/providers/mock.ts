import type { Genre, Track } from "@/features/game";
import { GENRES } from "@/features/game";
import type { MusicProvider } from "../provider";

const ARTISTS = ["Nova Onda", "Pulso Azul", "Estrela Cadente", "Mar Aberto", "Neon Rio", "Quarto Verde"];

/** Catálogo determinístico e offline: usado em testes, e2e e desenvolvimento. */
export function createMockProvider(): MusicProvider {
  return {
    id: "mock",
    async getTracksByGenre(genre: Genre, limit: number): Promise<Track[]> {
      const g = GENRES.indexOf(genre);
      return Array.from({ length: limit }, (_, i) => ({
        id: `mock-${g}-${i}`,
        title: `${genre} Hit ${i + 1}`,
        artist: ARTISTS[(g + i) % ARTISTS.length],
      }));
    },
  };
}
