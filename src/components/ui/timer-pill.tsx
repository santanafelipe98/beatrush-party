import { cn } from "@/lib/cn";

/** Formata segundos como m:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TimerPill({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <div
      role="timer"
      className={cn(
        "rounded-full border border-amber bg-amber/15 px-4 py-1.5 font-black leading-none text-amber tabular-nums",
        className,
      )}
    >
      {formatClock(seconds)}
    </div>
  );
}
