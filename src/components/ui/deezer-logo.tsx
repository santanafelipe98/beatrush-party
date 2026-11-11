"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/**
 * Logo oficial do Deezer, obrigatório em todo app que usa a API (ver docs/04-music-providers.md).
 *
 * - É o arquivo do kit de marca, servido SEM alteração (`unoptimized`: o Next não o recodifica).
 * - Só escala proporcionalmente: nunca mude cor, proporção, nem aplique efeito ou animação.
 * - É branco sobre transparente: use apenas sobre fundo escuro.
 * - O arquivo não tem margem própria; mantenha espaço livre ao redor (≥ metade da altura).
 */
export const DEEZER_LOGO_SRC = "/brand/deezer/Logo%20Horizontal.png";
const NATIVE = { width: 714, height: 200 } as const;

export function DeezerLogo({ height = 32, className }: { height?: number; className?: string }) {
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
