"use client";

import { motion } from "framer-motion";
import type { OutcomeBranch } from "@/types";

interface ProbabilityBarsProps {
  outcomes: OutcomeBranch[];
}

function getProbabilityColor(probability: number): string {
  if (probability >= 0.4) return "#ff3b3b";
  if (probability >= 0.25) return "#f0a500";
  if (probability >= 0.15) return "#f0c040";
  return "#00d4ff";
}

export function ProbabilityBars({ outcomes }: ProbabilityBarsProps) {
  const sorted = [...outcomes].sort((a, b) => b.probability - a.probability);

  return (
    <div className="space-y-3">
      {sorted.map((outcome, i) => {
        const color = getProbabilityColor(outcome.probability);
        const pct = Math.round(outcome.probability * 100);

        return (
          <div key={outcome.label} className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-white/75 font-ui leading-tight flex-1">
                {outcome.label}
              </span>
              <span
                className="text-sm font-mono font-bold shrink-0"
                style={{ color }}
              >
                {pct}%
              </span>
            </div>

            {/* Bar */}
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.08 }}
                className="h-full rounded-full"
                style={{ backgroundColor: color, opacity: 0.85 }}
              />
            </div>

            {/* Description */}
            {outcome.description && (
              <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">
                {outcome.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
