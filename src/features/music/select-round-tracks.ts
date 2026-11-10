import { OPTION_COUNT, type Genre, type Track } from "@/features/game";
import type { MusicProvider } from "./provider";

export interface RoundTracks {
  track: Track;
  distractors: Track[];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sorteia `count` faixas (alternando entre os gêneros vencedores) e, para cada,
 * 3 distratores com título e artista diferentes.
 */
export async function selectRoundTracks(
  provider: MusicProvider,
  genres: Genre[],
  count: number,
  rng: () => number = Math.random,
): Promise<RoundTracks[]> {
  const perGenre = Math.ceil(count / genres.length) + OPTION_COUNT;
  const pools = await Promise.all(genres.map((g) => provider.getTracksByGenre(g, perGenre * 2)));

  const seen = new Set<string>();
  const queues = pools.map((pool) =>
    shuffle(pool, rng).filter((t) => {
      const key = `${t.title}|${t.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
  const all = queues.flat();

  const picked: Track[] = [];
  for (let i = 0; picked.length < count && queues.some((q) => q.length); i++) {
    const next = queues[i % queues.length].shift();
    if (next) picked.push(next);
  }
  if (picked.length < count || all.length < OPTION_COUNT)
    throw new Error("catálogo insuficiente para montar a partida");

  return picked.map((track) => ({
    track,
    distractors: shuffle(
      all.filter((t) => t.id !== track.id && t.title !== track.title),
      rng,
    ).slice(0, OPTION_COUNT - 1),
  }));
}
