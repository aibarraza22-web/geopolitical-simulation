"use client";

import { getRiskColor } from "@/lib/utils";
import { SeverityBadge } from "@/components/ui/Badge";
import type { RegionRiskData } from "@/types";

interface RiskTooltipProps {
  data: RegionRiskData;
  x: number;
  y: number;
}

// Build a simple inline SVG sparkline from an array of values (0-100)
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;

  const width = 120;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const polyline = points.join(" ");

  // Build fill path: go to bottom-right, bottom-left, close
  const lastX = width;
  const firstX = 0;
  const fillPath = `M ${polyline} L ${lastX},${height} L ${firstX},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`sparkGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={fillPath}
        fill={`url(#sparkGrad-${color.replace("#", "")})`}
      />
      {/* Line */}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Last point dot */}
      <circle
        cx={width}
        cy={height - ((values[values.length - 1]! - min) / range) * height}
        r={2}
        fill={color}
      />
    </svg>
  );
}

export function RiskTooltip({ data, x, y }: RiskTooltipProps) {
  const riskColor = getRiskColor(data.risk_score);
  const trendSymbol = data.trend_delta > 0 ? "▲" : data.trend_delta < 0 ? "▼" : "—";
  const trendColor =
    data.trend_delta > 0 ? "#ff3b3b" : data.trend_delta < 0 ? "#00e676" : "#6b7280";

  // Clamp to viewport
  const tooltipWidth = 280;
  const left = Math.min(
    x + 14,
    typeof window !== "undefined" ? window.innerWidth - tooltipWidth - 16 : x
  );
  const top = Math.max(y - 30, 8);

  // Simulate sparkline data from trend_delta (in real usage would come from risk_score_history)
  // We generate a plausible 7-point curve ending at current score
  const sparkValues: number[] = (() => {
    const current = data.risk_score;
    const delta = data.trend_delta;
    const start = Math.max(0, Math.min(100, current - delta));
    return Array.from({ length: 7 }, (_, i) => {
      const progress = i / 6;
      // slight noise + smooth trend
      const noise = (Math.sin(i * 2.3 + current) * 2);
      return Math.max(0, Math.min(100, start + (delta * progress) + noise));
    });
  })();

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left, top }}
    >
      <div
        className="bg-axiom-panel border rounded-sm shadow-2xl overflow-hidden"
        style={{
          width: tooltipWidth,
          borderColor: `${riskColor}40`,
          boxShadow: `0 0 24px ${riskColor}18`,
        }}
      >
        {/* Accent bar */}
        <div className="h-[2px]" style={{ backgroundColor: riskColor }} />

        {/* Header */}
        <div className="px-3 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
          <span className="text-xs font-bold text-white/90 font-ui tracking-wide">
            {data.region}
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className="text-[10px] font-mono font-semibold flex items-center gap-0.5"
              style={{ color: trendColor }}
            >
              {trendSymbol}{" "}
              {data.trend_delta !== 0
                ? Math.abs(data.trend_delta).toFixed(1)
                : "—"}
            </span>
            <span
              className="text-xl font-display tracking-wider"
              style={{ color: riskColor }}
            >
              {data.risk_score}
            </span>
          </div>
        </div>

        {/* Risk gauge + sparkline */}
        <div className="px-3 pt-2.5 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
              Risk Index — 7d trend
            </span>
            <span className="text-[9px] font-mono text-white/40">
              {data.signals_today} signals today
            </span>
          </div>

          {/* Gauge bar */}
          <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${data.risk_score}%`,
                backgroundColor: riskColor,
                opacity: 0.85,
              }}
            />
          </div>

          {/* Sparkline */}
          <Sparkline values={sparkValues} color={riskColor} />
        </div>

        {/* Top 2 signals */}
        {data.top_signals && data.top_signals.length > 0 && (
          <div className="px-3 py-2 border-t border-white/[0.05]">
            <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1.5">
              Recent Signals
            </p>
            <div className="space-y-1.5">
              {data.top_signals.slice(0, 2).map((sig) => (
                <div key={sig.id} className="flex items-start gap-2">
                  <SeverityBadge severity={sig.severity} size="sm" />
                  <p className="text-[10px] text-white/60 leading-tight flex-1 min-w-0 line-clamp-2">
                    {sig.headline}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 py-1.5 bg-white/[0.02] border-t border-white/[0.05]">
          <p className="text-[9px] font-mono text-white/25">
            {data.country_codes.join(" · ")} · Click to drill down
          </p>
        </div>
      </div>
    </div>
  );
}
