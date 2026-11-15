"use client";

import Image from "next/image";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/**
 * Assinatura oficial "Powered by Deezer", exigida pelas diretrizes da API
 * (https://developers.deezer.com/guidelines/logo). Ver docs/04-music-providers.md.
 *
 * STATUS: DESATIVADA POR PADRÃO. Enquanto o Deezer não responde sobre o uso da marca, nenhuma tela
 * mostra o logo nem o texto "Powered by Deezer". Para religar (build/start com a variável):
 *
 *     NEXT_PUBLIC_DEEZER_BRANDING=on
 *
 * ATENÇÃO: as diretrizes da API exigem o logo visível. Com a marca desligada o app NÃO cumpre essa
 * exigência: não publique uma instância aberta até resolver (autorização do Deezer e religar).
 *
 * O ARQUIVO DO LOGO NÃO FAZ PARTE DO REPOSITÓRIO: os termos do Brand Hub do Deezer
 * (https://deezerbrand.com/) só permitem usar os Brand Assets a quem recebeu acesso/autorização
 * do Deezer e proíbem repassá-los a terceiros. Quem opera o app coloca a sua cópia autorizada em
 * `public/brand/deezer/` (ignorada pelo git). Com a marca ligada e sem o arquivo, mostra-se só o texto
 * "Powered by Deezer" como alternativa de desenvolvimento: NÃO substitui o logo oficial em produção.
 *
 * Quando o arquivo existe:
 * - é servido SEM alteração (`unoptimized`: o Next não o recodifica); vetorial, nítido em qualquer tamanho;
 * - só escala proporcionalmente: nunca mude cor, proporção, nem aplique efeito ou animação;
 * - é branco (`fill="white"`) sobre transparente: use apenas sobre fundo escuro;
 * - não tem margem própria; mantenha espaço livre ao redor (≥ metade da altura).
 */
export const DEEZER_LOGO_SRC = "/brand/deezer/Signatures-PoweredBy-DE.svg";
const NATIVE = { width: 2500, height: 367 } as const;

/** Lido a cada chamada (o Next troca `process.env.NEXT_PUBLIC_*` pelo valor literal no build). */
export function isDeezerBrandingEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEEZER_BRANDING === "on";
}

export function DeezerLogo({ height = 36, className }: { height?: number; className?: string }) {
  const { t } = useI18n();
  const [missing, setMissing] = useState(false);

  if (!isDeezerBrandingEnabled()) return null;

  // (o next/image já reatribui `src` quando há `onError`, cobrindo falhas ocorridas antes da hidratação)
  if (missing) {
    return (
      <span
        data-testid="deezer-logo"
        className={cn("inline-flex select-none items-center whitespace-nowrap font-extrabold tracking-tight text-white", className)}
        style={{ height, fontSize: Math.round(height * 0.5) }}
      >
        {t("brand.deezer")}
      </span>
    );
  }

  return (
    <Image
      data-testid="deezer-logo"
      src={DEEZER_LOGO_SRC}
      alt={t("brand.deezer")}
      width={NATIVE.width}
      height={NATIVE.height}
      unoptimized
      loading="eager"
      draggable={false}
      onError={() => setMissing(true)}
      style={{ height, width: "auto" }}
      className={cn("select-none", className)}
    />
  );
}
