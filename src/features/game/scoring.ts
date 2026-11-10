export const MAX_POINTS = 1000;
export const MIN_CORRECT_POINTS = 300;

/**
 * Pontos por resposta correta: 1000 no instante 0, decaindo linearmente
 * até 300 no fim do tempo. Resposta errada vale 0.
 */
export function pointsFor(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return MIN_CORRECT_POINTS;
  const ratio = Math.min(Math.max(elapsedMs / durationMs, 0), 1);
  const span = MAX_POINTS - MIN_CORRECT_POINTS;
  return Math.round(MAX_POINTS - ratio * span);
}
