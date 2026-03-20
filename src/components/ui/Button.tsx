"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoadingSpinner } from "./LoadingSpinner";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "cyan";
type ButtonSize = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-axiom-amber text-black font-bold hover:bg-amber-400 active:bg-amber-600 border border-axiom-amber/50",
  secondary:
    "bg-white/[0.06] text-white/80 hover:bg-white/[0.10] active:bg-white/[0.04] border border-white/[0.10]",
  ghost:
    "bg-transparent text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent",
  danger:
    "bg-axiom-red/20 text-axiom-red hover:bg-axiom-red/30 active:bg-axiom-red/15 border border-axiom-red/40",
  cyan:
    "bg-axiom-cyan/15 text-axiom-cyan hover:bg-axiom-cyan/25 border border-axiom-cyan/40",
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-[11px] gap-1",
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconPosition = "left",
  children,
  fullWidth = false,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        "inline-flex items-center justify-center rounded-[3px] font-ui font-semibold uppercase tracking-wider transition-all duration-150 select-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      {...props}
    >
      {loading ? (
        <>
          <LoadingSpinner size="sm" />
          {children && <span>{children}</span>}
        </>
      ) : (
        <>
          {icon && iconPosition === "left" && <span className="flex-shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === "right" && <span className="flex-shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
}
