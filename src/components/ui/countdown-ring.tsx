"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

interface CountdownRingProps {
  seconds: number;
  /** 0–100: quanto do tempo ainda resta. */
  percent: number;
  size?: number;
  className?: string;
}

/** Anel de contagem regressiva (conic-gradient), como na tela "Tocando" do protótipo. */
export function CountdownRing({ seconds, percent, size = 168, className }: CountdownRingProps) {
  const { t } = useI18n();
  const pct = Math.min(100, Math.max(0, percent));
  const inner = size * 0.84;
  return (
    <div
      role="timer"
      aria-label={t("ring.label", { n: Math.ceil(seconds) })}
      className={cn("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#00DFD8 0 ${pct}%, #22222e ${pct}% 100%)`,
        boxShadow: "0 0 50px #00DFD844",
      }}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-bg"
        style={{ width: inner, height: inner }}
      >
        <span className="font-black leading-none tabular-nums" style={{ fontSize: size * 0.37 }}>
          {Math.ceil(seconds)}
        </span>
        <span className="text-[10px] font-bold tracking-[0.2em] text-muted">{t("ring.seconds")}</span>
      </div>
    </div>
  );
}
