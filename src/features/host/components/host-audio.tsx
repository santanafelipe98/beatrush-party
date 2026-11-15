"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Toca o trecho da faixa na TV. Navegadores podem bloquear autoplay sem gesto do usuário;
 * nesse caso mostramos um botão para liberar o som.
 *
 * O arquivo é carregado assim que `src` chega (durante a contagem 3-2-1) e a reprodução só começa em
 * `startAt` (relógio do servidor, convertido com `clockOffset`), para a música e o "valendo" coincidirem.
 */
export function HostAudio({
  src,
  muted,
  startAt,
  clockOffset = 0,
}: {
  src?: string;
  muted: boolean;
  /** Instante (epoch ms do servidor) em que a música deve começar; ausente = agora. */
  startAt?: number;
  clockOffset?: number;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  // o offset muda a cada snapshot: guardado em ref para NÃO reiniciar a música a cada atualização
  const offsetRef = useRef(clockOffset);
  useEffect(() => {
    offsetRef.current = clockOffset;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.currentTime = 0;
    const play = () =>
      void el.play().then(
        () => setBlocked(false),
        () => setBlocked(true),
      );
    const wait = startAt == null ? 0 : startAt - (Date.now() + offsetRef.current);
    if (wait <= 0) {
      play();
      return;
    }
    const id = setTimeout(play, wait);
    return () => clearTimeout(id);
  }, [src, startAt]);

  if (!src) return null;
  return (
    <>
      <audio ref={ref} src={src} muted={muted} preload="auto" />
      {blocked && !muted && (
        <button
          type="button"
          onClick={() => ref.current?.play().then(() => setBlocked(false))}
          className="fixed bottom-24 right-4 z-20 rounded-full bg-amber px-5 py-3 text-sm font-extrabold text-bg"
        >
          {t("host.enableSound")}
        </button>
      )}
    </>
  );
}
