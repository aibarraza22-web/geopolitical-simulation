"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  accentColor?: string;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function Card({
  children,
  className,
  accentColor,
  onClick,
  hoverable = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-sm border border-white/[0.07] bg-axiom-panel overflow-hidden",
        paddingMap[padding],
        hoverable &&
          "cursor-pointer transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.02]",
        onClick && "cursor-pointer",
        className
      )}
    >
      {/* Top accent bar */}
      {accentColor && (
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ backgroundColor: accentColor }}
        />
      )}
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-4",
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3
      className={cn(
        "text-xs font-semibold uppercase tracking-widest text-white/50 font-ui",
        className
      )}
    >
      {children}
    </h3>
  );
}
