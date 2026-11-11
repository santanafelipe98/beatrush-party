"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/**
 * Assinatura oficial "Powered by Deezer", obrigatória em todo app que usa a API (ver docs/04-music-providers.md).
 *
 * - É o arquivo SVG do kit de marca, servido SEM alteração (`unoptimized`: o Next não o recodifica).
 *   Vetorial: fica nítido em qualquer tamanho/densidade de tela.
 * - Só escala proporcionalmente: nunca mude cor, proporção, nem aplique efeito ou animação.
 * - É branco (`fill="white"`) sobre transparente: use apenas sobre fundo escuro.
 * - O arquivo não tem margem própria; mantenha espaço livre ao redor (≥ metade da altura).
 */
export const DEEZER_LOGO_SRC = "/brand/deezer/Signatures-PoweredBy-DE.svg";
const NATIVE = { width: 2500, height: 367 } as const;

export function DeezerLogo({ height = 36, className }: { height?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <Image
      src={DEEZER_LOGO_SRC}
      alt={t("brand.deezer")}
      width={NATIVE.width}
      height={NATIVE.height}
      unoptimized
      loading="eager"
      draggable={false}
      style={{ height, width: "auto" }}
      className={cn("select-none", className)}
    />
  );
}
