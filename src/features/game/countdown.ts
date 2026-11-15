export const COUNTDOWN_STEPS = 3;
export const DEFAULT_COUNTDOWN_MS = 3_000;

/**
 * Número a exibir na contagem regressiva ("3", "2", "1") ou `null` quando acabou/não há contagem.
 * Divide `countdownMs` em `steps` partes iguais: com 3000 ms são 3, 2, 1 de um segundo cada
 * (e a contagem continua legível se o tempo for configurado menor, ex.: nos testes).
 */
export function countdownStep(remainingMs: number, countdownMs: number, steps = COUNTDOWN_STEPS): number | null {
  if (countdownMs <= 0 || remainingMs <= 0) return null;
  const n = Math.ceil(remainingMs / (countdownMs / steps));
  return Math.min(steps, Math.max(1, n));
}
