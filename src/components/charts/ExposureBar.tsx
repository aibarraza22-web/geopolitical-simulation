"use client";

import { cn, getRiskColor } from "@/lib/utils";
import { motion } from "framer-motion";

interface ExposureBarProps {
  label: string;
  score: number;
  value?: number;
  showValue?: boolean;
  className?: string;
  animate?: boolean;
  height?: number;
}

export function ExposureBar({
  label,
  score,
  value,
  showValue = true,
  className,
  animate = true,
  height = 4,
}: ExposureBarProps) {
  const color = getRiskColor(score);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/60 font-ui truncate max-w-[60%]">
          {label}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {value !== undefined && showValue && (
            <span className="text-[10px] font-mono text-white/40">
              ${(value / 1_000_000).toFixed(1)}M
            </span>
          )}
          <span
            className="text-xs font-mono font-bold"
            style={{ color }}
          >
            {score}
          </span>
        </div>
      </div>
      <div
        className="w-full rounded-full bg-white/[0.06]"
        style={{ height: `${height}px` }}
      >
        {animate ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            className="h-full rounded-full"
            style={{ backgroundColor: color, opacity: 0.85 }}
          />
        ) : (
          <div
            className="h-full rounded-full"
            style={{ width: `${score}%`, backgroundColor: color, opacity: 0.85 }}
          />
        )}
      </div>
    </div>
  );
}
