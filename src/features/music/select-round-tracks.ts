import { GENRES, OPTION_COUNT, type Genre, type Track } from "@/features/game";
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
 * Define o gênero de cada turno a partir das escolhas dos jogadores (uma por jogador, com repetição:
 * quem foi escolhido por 2 jogadores tem o dobro de chance). Embaralha as escolhas e as consome até
 * acabarem; então embaralha de novo, sem repetir o mesmo gênero em turnos seguidos quando há outro.
 * Sem nenhuma escolha, sorteia 3 gêneros.
 */
export function planGenres(picks: Genre[], count: number, rng: () => number = Math.random): Genre[] {
  const source = picks.length ? picks : shuffle([...GENRES], rng).slice(0, 3);
  const plan: Genre[] = [];
  while (plan.length < count) {
    const bag = shuffle(source, rng);
    if (plan.length && bag[0] === plan[plan.length - 1]) {
      const other = bag.findIndex((g) => g !== bag[0]);
      if (other > 0) [bag[0], bag[other]] = [bag[other], bag[0]];
    }
    plan.push(...bag);
  }
  return plan.slice(0, count);
}

/**
 * Sorteia `count` faixas, uma por turno, do gênero planejado por `planGenres`, e para cada 3
 * distratores do MESMO gênero (com título diferente); só completa com outros gêneros se o catálogo
 * daquele gênero for pequeno demais.
 */
export async function selectRoundTracks(
  provider: MusicProvider,
  picks: Genre[],
  count: number,
  rng: () => number = Math.random,
): Promise<RoundTracks[]> {
  const plan = planGenres(picks, count, rng);
  const genres = [...new Set(plan)];
  const needed = (g: Genre) => plan.filter((p) => p === g).length;
  const pools = await Promise.all(genres.map((g) => provider.getTracksByGenre(g, (needed(g) + OPTION_COUNT) * 2)));

  const seen = new Set<string>();
  const queues = pools.map((pool) =>
    shuffle(pool, rng).filter((t) => {
      const key = `${t.title}|${t.artist}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
  // Cópia do pool de cada gênero (as filas abaixo são consumidas) e o gênero de cada faixa.
  const genrePools = queues.map((q) => [...q]);
  const all = genrePools.flat();
  const genreOf = new Map<string, number>();
  genrePools.forEach((pool, gi) => pool.forEach((t) => genreOf.set(t.id, gi)));

  const picked: Track[] = [];
  for (const g of plan) {
    // se o catálogo do gênero acabou, usa outro gênero em vez de derrubar a partida
    const q = queues[genres.indexOf(g)].length ? queues[genres.indexOf(g)] : queues.find((x) => x.length);
    const next = q?.shift();
    if (next) picked.push(next);
  }
  if (picked.length < count || all.length < OPTION_COUNT)
    throw new Error("catálogo insuficiente para montar a partida");

  return picked.map((track) => {
    const eligible = (t: Track) => t.id !== track.id && t.title !== track.title;
    const same = shuffle(genrePools[genreOf.get(track.id) ?? 0].filter(eligible), rng);
    const others = shuffle(all.filter((t) => eligible(t) && genreOf.get(t.id) !== genreOf.get(track.id)), rng);
    return { track, distractors: [...same, ...others].slice(0, OPTION_COUNT - 1) };
  });
}
