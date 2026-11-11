"use client";

import { useId, useRef } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/**
 * Botão "Sobre" + diálogo com o aviso legal: o app não detém direitos das músicas, não é
 * fornecedor de conteúdo (apenas consome o Deezer) e é de uso exclusivamente não comercial.
 *
 * É um modal sobre a tela atual (e não uma página) para que, na TV, abrir o "Sobre" nunca
 * derrube a sala em andamento. Usa o `<dialog>` nativo: foco preso, Esc fecha e o foco volta
 * ao botão que o abriu.
 */
export function AboutDialog({ className }: { className?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => {
          const d = ref.current;
          if (!d) return;
          d.showModal();
          // o foco inicial vai ao botão Fechar (no fim) e o navegador rola até ele: volta ao topo
          d.scrollTop = 0;
        }}
        className={cn(
          "text-sm font-bold text-muted underline-offset-4 transition hover:text-white hover:underline focus-visible:text-white focus-visible:underline",
          className,
        )}
      >
        {t("about.open")}
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        // clicar no fundo (o próprio <dialog>, que não tem padding) fecha
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[85dvh] w-[min(92vw,34rem)] overflow-auto rounded-2xl border border-line-strong bg-surface p-0 text-left text-white shadow-[0_0_60px_#7928ca55] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-brand text-2xl font-black leading-tight">
            {t("about.title")}
          </h2>
          <p className="text-base font-semibold text-soft">{t("about.intro")}</p>
          <p className="text-sm leading-relaxed text-soft">{t("about.rights")}</p>
          <p className="text-sm leading-relaxed text-soft">{t("about.noStorage")}</p>
          <p className="text-sm leading-relaxed text-soft">{t("about.trademark")}</p>
          <p className="rounded-xl border border-amber bg-amber/10 px-4 py-3 text-sm font-extrabold text-amber">
            {t("about.nonCommercial")}
          </p>
          <button
            type="button"
            autoFocus
            onClick={() => ref.current?.close()}
            className="bg-brand mt-1 self-end rounded-xl px-6 py-3 text-base font-extrabold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {t("about.close")}
          </button>
        </div>
      </dialog>
    </>
  );
}
