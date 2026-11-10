import { cn } from "@/lib/cn";

interface EqualizerProps {
  bars?: number;
  /** Variação determinística das animações. */
  seed?: number;
  className?: string;
  barClassName?: string;
  /** Origem da escala: "bottom" (barras de chão) ou "center". */
  origin?: "bottom" | "center";
}

/** Barras animadas de equalizador (puramente decorativas). */
export function Equalizer({
  bars = 16,
  seed = 1,
  className,
  barClassName = "bg-pink",
  origin = "bottom",
}: EqualizerProps) {
  return (
    <div aria-hidden className={cn("flex gap-1.5", origin === "bottom" ? "items-end" : "items-center", className)}>
      {Array.from({ length: bars }, (_, i) => {
        const duration = (0.35 + ((i * 37 * seed) % 60) / 100).toFixed(2);
        const delay = (((i * 13 * seed) % 40) / 100).toFixed(2);
        return (
          <div
            key={i}
            className={cn("h-full flex-1 rounded-sm", barClassName)}
            style={{
              transformOrigin: origin,
              animation: `eq ${duration}s ease-in-out ${delay}s infinite alternate`,
            }}
          />
        );
      })}
    </div>
  );
}
