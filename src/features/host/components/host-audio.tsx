"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Toca o trecho da faixa na TV. Navegadores podem bloquear autoplay sem gesto do usuário;
 * nesse caso mostramos um botão para liberar o som.
 */
export function HostAudio({ src, muted }: { src?: string; muted: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.currentTime = 0;
    el.play().then(
      () => setBlocked(false),
      () => setBlocked(true),
    );
  }, [src]);

  if (!src) return null;
  return (
    <>
      <audio ref={ref} src={src} muted={muted} preload="auto" />
      {blocked && !muted && (
        <button
          type="button"
          onClick={() => ref.current?.play().then(() => setBlocked(false))}
          className="fixed bottom-20 right-4 z-20 rounded-full bg-amber px-5 py-3 text-sm font-extrabold text-bg"
        >
          {t("host.enableSound")}
        </button>
      )}
    </>
  );
}
