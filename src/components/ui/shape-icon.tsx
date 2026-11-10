import { cn } from "@/lib/cn";
import { SHAPES } from "./theme";

/** Forma geométrica branca (▲ ◆ ● ■) usada nas opções de resposta. */
export function ShapeIcon({ index, className }: { index: number; className?: string }) {
  const shape = SHAPES[index];
  return (
    <div
      role="img"
      aria-label={shape.name}
      className={cn("bg-white", className)}
      style={{ clipPath: shape.clip }}
    />
  );
}
