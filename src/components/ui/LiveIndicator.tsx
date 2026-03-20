"use client";

import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  className?: string;
  label?: string;
  color?: "green" | "amber" | "red";
}

const colorMap = {
  green: {
    dot: "bg-axiom-green",
    ring: "bg-axiom-green/40",
    text: "text-axiom-green",
  },
  amber: {
    dot: "bg-axiom-amber",
    ring: "bg-axiom-amber/40",
    text: "text-axiom-amber",
  },
  red: {
    dot: "bg-axiom-red",
    ring: "bg-axiom-red/40",
    text: "text-axiom-red",
  },
};

export function LiveIndicator({
  className,
  label = "LIVE",
  color = "green",
}: LiveIndicatorProps) {
  const colors = colorMap[color];

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {/* Pulsing dot with ring */}
      <div className="relative flex items-center justify-center w-3 h-3">
        <span
          className={cn(
            "absolute inline-flex w-3 h-3 rounded-full opacity-60 animate-ping",
            colors.ring
          )}
        />
        <span
          className={cn(
            "relative inline-flex w-2 h-2 rounded-full",
            colors.dot
          )}
        />
      </div>
      {/* Label */}
      <span
        className={cn(
          "text-[10px] font-mono font-bold tracking-[0.2em] uppercase",
          colors.text
        )}
      >
        {label}
      </span>
    </div>
  );
}
