"use client";

import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { SHAPES } from "./theme";

/** Forma geométrica branca (▲ ◆ ● ■) usada nas opções de resposta. */
export function ShapeIcon({ index, className }: { index: number; className?: string }) {
  const { t } = useI18n();
  const shape = SHAPES[index];
  return (
    <div
      role="img"
      aria-label={t(shape.key)}
      className={cn("bg-white", className)}
      style={{ clipPath: shape.clip }}
    />
  );
}
