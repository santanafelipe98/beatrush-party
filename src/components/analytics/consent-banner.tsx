"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { setConsent, useConsent } from "./consent";

/** Distância do banner até o fundo da tela (classe bottom-12), acima do rodapé da TV. */
const BOTTOM_OFFSET_PX = 48;

/** Aviso de cookies do Analytics. Aceitar e recusar têm o mesmo destaque. */
export function ConsentBanner() {
  const { t } = useI18n();
  const consent = useConsent();
  const ref = useRef<HTMLDivElement>(null);
  const shown = consent === "pending";

  // Reserva o espaço do banner no fim da página: o conteúdo (ex.: "Entrar no Jogo") pode rolar
  // para cima dele em vez de ficar escondido por trás.
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    const reserve = () => {
      document.body.style.paddingBottom = `${el.offsetHeight + BOTTOM_OFFSET_PX + 8}px`;
    };
    reserve();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(reserve) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [shown]);

  if (!shown) return null;

  const btn =
    "rounded-xl border-2 border-line-strong bg-surface-2 px-5 py-2.5 text-sm font-extrabold transition hover:border-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  return (
    <div
      ref={ref}
      role="region"
      aria-label={t("consent.label")}
      data-testid="consent-banner"
      // acima do rodapé da TV (Sobre/idioma, 36 px)
      className="fixed inset-x-0 bottom-12 z-50 mx-auto flex w-[min(94vw,40rem)] flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-4 text-white shadow-[0_0_40px_#00000099] sm:flex-row sm:items-center"
    >
      <p className="flex-1 text-sm leading-snug text-soft">{t("consent.text")}</p>
      <div className="flex gap-2 sm:shrink-0">
        <button type="button" data-testid="consent-reject" onClick={() => setConsent("denied")} className={`${btn} flex-1`}>
          {t("consent.reject")}
        </button>
        <button type="button" data-testid="consent-accept" onClick={() => setConsent("granted")} className={`${btn} flex-1`}>
          {t("consent.accept")}
        </button>
      </div>
    </div>
  );
}
