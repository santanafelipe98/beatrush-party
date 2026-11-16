/** ID de medição do GA4 (ex.: G-ABC123XYZ). */
const GA_ID = /^G-[A-Z0-9]{4,20}$/;

/**
 * Valida o ID vindo do ambiente. O valor entra num script inline, então só aceita o formato do GA4;
 * qualquer outra coisa (vazio, malformado, tentativa de injeção) desliga o Analytics.
 */
export function parseGaId(raw: string | undefined): string | null {
  const id = raw?.trim();
  return id && GA_ID.test(id) ? id : null;
}
