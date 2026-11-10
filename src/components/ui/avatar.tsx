import { cn } from "@/lib/cn";
import { AVATAR_COLORS } from "./theme";

interface AvatarProps {
  name: string;
  avatar: number;
  size?: number;
  glow?: boolean;
  className?: string;
}

export function Avatar({ name, avatar, size = 44, glow, className }: AvatarProps) {
  const color = AVATAR_COLORS[avatar % AVATAR_COLORS.length];
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center rounded-full font-black text-bg", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        background: color,
        boxShadow: glow ? `0 0 ${size * 0.5}px ${color}88` : undefined,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
