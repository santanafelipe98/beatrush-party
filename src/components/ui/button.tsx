import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "outline";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-[0_0_30px_#ff008055]",
  accent: "bg-cyan text-bg",
  outline: "border-2 border-[#444458] text-white",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-xl px-6 py-4 text-lg font-extrabold transition active:scale-[0.98]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
