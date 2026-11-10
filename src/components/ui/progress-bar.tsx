import { cn } from "@/lib/cn";

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  className?: string;
  fillClassName?: string;
  label?: string;
}

export function ProgressBar({ value, className, fillClassName = "bg-brand", label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-1.5 overflow-hidden rounded-full bg-track", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-200", fillClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}
