"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Shield,
  Eye,
  BarChart2,
} from "lucide-react";
import { ProbabilityBars } from "./ProbabilityBars";
import { cn, getRiskColor } from "@/lib/utils";
import type { SimulationOutput, AffectedAsset, ConfidenceLevel, EscalationPath } from "@/types";

// =============================================================================
// Escalation Path bar — used for Prediction output
// =============================================================================
const IMPACT_COLORS: Record<string, string> = {
  CATASTROPHIC: "#ff3b3b",
  SEVERE: "#ff8c00",
  MODERATE: "#f0a500",
  LOW: "#00e676",
};

function EscalationPathBar({
  path,
  index,
}: {
  path: EscalationPath;
  index: number;
}) {
  const color = IMPACT_COLORS[path.impact_level] ?? "#6b7280";
  const pct = Math.round(path.probability * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      className="mb-3"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]"
            style={{
              color,
              backgroundColor: `${color}18`,
              border: `1px solid ${color}40`,
            }}
          >
            {path.impact_level}
          </span>
          <span className="text-xs font-semibold text-white/80">{path.label}</span>
        </div>
        <span className="text-sm font-display tracking-wider" style={{ color }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay: index * 0.07 + 0.1, ease: "easeOut" }}
        />
      </div>
      <p className="text-[11px] text-white/40 leading-snug">{path.description}</p>
    </motion.div>
  );
}

interface SimOutputWithPredictionProps extends SimOutputProps {
  escalationPaths?: EscalationPath[];
}

interface SimOutputProps {
  output: SimulationOutput;
  isStreaming?: boolean;
  streamingText?: string;
}

const directionIcon = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
};

const directionColor = {
  positive: "#00e676",
  negative: "#ff3b3b",
  neutral: "#6b7280",
};

const magnitudeWidth = {
  low: "w-2",
  medium: "w-4",
  high: "w-6",
};

const confidenceConfig: Record<ConfidenceLevel, { label: string; color: string }> = {
  low: { label: "LOW CONFIDENCE", color: "#ff3b3b" },
  medium: { label: "MEDIUM CONFIDENCE", color: "#f0a500" },
  high: { label: "HIGH CONFIDENCE", color: "#00e676" },
};

function AssetRow({ asset }: { asset: AffectedAsset }) {
  const Icon = directionIcon[asset.direction];
  const color = directionColor[asset.direction];

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div
        className="flex items-center justify-center w-6 h-6 rounded-sm shrink-0 mt-0.5"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={12} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-white/85 font-mono">
            {asset.asset}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {/* Magnitude dots */}
            {["low", "medium", "high"].map((level) => (
              <div
                key={level}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    (asset.magnitude === "high") ||
                    (asset.magnitude === "medium" && level !== "high") ||
                    (asset.magnitude === "low" && level === "low")
                      ? color
                      : "rgba(255,255,255,0.1)",
                  opacity:
                    (asset.magnitude === "high") ||
                    (asset.magnitude === "medium" && level !== "high") ||
                    (asset.magnitude === "low" && level === "low")
                      ? 0.9
                      : 1,
                }}
              />
            ))}
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>
              {asset.magnitude}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-white/45 leading-relaxed">
          {asset.rationale}
        </p>
      </div>
    </div>
  );
}

export function SimOutput({
  output,
  isStreaming = false,
  streamingText,
  escalationPaths,
}: SimOutputWithPredictionProps) {
  const confidence = confidenceConfig[output.confidenceLevel];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Confidence + depth header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: confidence.color }}
          />
          <span
            className="text-[10px] font-mono font-bold tracking-widest"
            style={{ color: confidence.color }}
          >
            {confidence.label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-white/30">
          AXIOM AI · claude-sonnet-4-5
        </span>
      </div>

      {/* Narrative */}
      <div className="rounded-sm border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
          <BarChart2 size={13} className="text-axiom-cyan" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
            Analysis Narrative
          </span>
        </div>
        <div className="px-4 py-3">
          {isStreaming && streamingText ? (
            <p className="text-sm text-white/75 leading-relaxed font-ui streaming-cursor">
              {streamingText}
            </p>
          ) : (
            <div className="space-y-3">
              {output.narrative.split("\n\n").map((para, i) => (
                <p key={i} className="text-sm text-white/75 leading-relaxed font-ui">
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Outcome branches */}
      <div className="rounded-sm border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
          <TrendingUp size={13} className="text-axiom-amber" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
            Scenario Outcomes
          </span>
          <span className="ml-auto text-[10px] font-mono text-white/30">
            {output.outcomes.length} branches
          </span>
        </div>
        <div className="px-4 py-3">
          <ProbabilityBars outcomes={output.outcomes} />
        </div>
      </div>

      {/* Escalation paths (for Prediction mode) */}
      {escalationPaths && escalationPaths.length > 0 && (
        <div className="rounded-sm border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
            <TrendingUp size={13} className="text-axiom-amber" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
              Escalation Paths
            </span>
          </div>
          <div className="px-4 py-3">
            {escalationPaths.map((path, i) => (
              <EscalationPathBar key={i} path={path} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Affected assets */}
      <div className="rounded-sm border border-white/[0.07] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
          <TrendingUp size={13} className="text-axiom-green" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">
            Affected Assets
          </span>
        </div>
        <div className="px-4 py-1">
          {output.affectedAssets.map((asset) => (
            <AssetRow key={asset.asset} asset={asset} />
          ))}
        </div>
      </div>

      {/* Recommended hedges */}
      <div className="rounded-sm border border-axiom-green/20 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
          <Shield size={13} className="text-axiom-green" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-axiom-green/70">
            Recommended Hedges
          </span>
        </div>
        <div className="px-4 py-3">
          <ul className="space-y-2">
            {output.recommendedHedges.map((hedge, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-axiom-green font-mono text-[10px] mt-0.5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-xs text-white/70 leading-snug">{hedge}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tripwires */}
      <div className="rounded-sm border border-axiom-red/20 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
          <AlertTriangle size={13} className="text-axiom-red" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-axiom-red/70">
            Escalation Tripwires
          </span>
        </div>
        <div className="px-4 py-3">
          <ul className="space-y-2">
            {output.tripwires.map((tripwire, i) => (
              <li key={i} className="flex items-start gap-2">
                <Eye size={10} className="text-axiom-red/50 mt-0.5 shrink-0" />
                <span className="text-xs text-white/65 leading-snug">{tripwire}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Analysis depth */}
      {output.analysisDepth && (
        <div className="px-3 py-2 bg-white/[0.02] rounded-sm border border-white/[0.05]">
          <p className="text-[10px] text-white/30 leading-relaxed font-mono">
            {output.analysisDepth}
          </p>
        </div>
      )}
    </motion.div>
  );
}
