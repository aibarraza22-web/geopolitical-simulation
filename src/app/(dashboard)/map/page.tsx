"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { WorldMap } from "@/components/map/WorldMap";
import { LayerToggles, DEFAULT_LAYERS } from "@/components/map/LayerToggles";
import { Card } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/ui/Badge";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { EmptyState } from "@/components/ui/EmptyState";
import { getRiskColor, formatRelativeTime, formatTrend, getTrendColor } from "@/lib/utils";
import type { MapLayer, RegionRiskData, RiskScore } from "@/types";
import { getCentroidFromCountryCodes } from "@/lib/country-coords";
import { Globe } from "lucide-react";

// Convert RiskScore DB row to RegionRiskData — coordinates derived dynamically from country_codes
function riskScoreToRegionData(rs: RiskScore): RegionRiskData | null {
  if (!rs.country_codes || rs.country_codes.length === 0) return null;
  const [latitude, longitude] = getCentroidFromCountryCodes(rs.country_codes);
  if (latitude === 0 && longitude === 0) return null;
  return {
    region: rs.region,
    country_codes: rs.country_codes,
    risk_score: rs.score,
    trend: rs.trend,
    trend_delta: rs.trend_delta,
    signals_today: rs.signals_today,
    latitude,
    longitude,
    top_signals: rs.top_signals ?? [],
    composite_breakdown: rs.composite_breakdown ?? {},
  } as RegionRiskData & { composite_breakdown: Record<string, number> };
}

export default function MapPage() {
  const [layers, setLayers] = useState<MapLayer[]>(DEFAULT_LAYERS);
  const [selectedRegion, setSelectedRegion] = useState<RegionRiskData | null>(null);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [regionRiskData, setRegionRiskData] = useState<RegionRiskData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/risk-scores")
      .then((r) => r.json())
      .then((json: { data?: RiskScore[] }) => {
        const scores = json.data ?? [];
        setRiskScores(scores);
        const regions = scores
          .map(riskScoreToRegionData)
          .filter((r): r is RegionRiskData => r !== null);
        setRegionRiskData(regions);
      })
      .catch(() => {
        setRiskScores([]);
        setRegionRiskData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLayerToggle = (id: string) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
    );
  };

  const handleRegionClick = (region: RegionRiskData) => {
    setSelectedRegion((prev) =>
      prev?.region === region.region ? null : region
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.07] bg-axiom-panel/50 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl tracking-widest text-white">
            RISK MAP
          </h1>
          <LayerToggles layers={layers} onToggle={handleLayerToggle} />
        </div>
        <LiveIndicator />
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0">
        {/* Map */}
        <div className="flex-1 relative">
          <WorldMap
            riskScores={regionRiskData}
            height={undefined as unknown as number}
            onRegionClick={handleRegionClick}
            activeLayers={layers.filter((l) => l.enabled).map((l) => l.id)}
          />
          <style>{`
            .rsm-svg { height: 100% !important; }
          `}</style>
        </div>

        {/* Right panel */}
        <div className="w-72 shrink-0 border-l border-white/[0.07] overflow-y-auto">
          {selectedRegion ? (
            <motion.div
              key={selectedRegion.region}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 space-y-4"
            >
              {/* Region header */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display text-2xl tracking-widest text-white">
                    {selectedRegion.region.toUpperCase()}
                  </h3>
                  <button
                    onClick={() => setSelectedRegion(null)}
                    className="text-white/30 hover:text-white/60 text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[10px] font-mono text-white/30">
                  {selectedRegion.country_codes.join(" · ")}
                </p>
              </div>

              {/* Risk score */}
              <div className="rounded-sm border border-white/[0.07] p-3">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    Risk Index
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: getTrendColor(selectedRegion.trend_delta) }}
                    >
                      {formatTrend(selectedRegion.trend_delta)} 7d
                    </span>
                    <span
                      className="text-4xl font-display tracking-wider"
                      style={{ color: getRiskColor(selectedRegion.risk_score) }}
                    >
                      {selectedRegion.risk_score}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${selectedRegion.risk_score}%`,
                      backgroundColor: getRiskColor(selectedRegion.risk_score),
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] font-mono text-white/20">0</span>
                  <span className="text-[9px] font-mono text-white/20">100</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-sm border border-white/[0.07] p-2.5 text-center">
                  <p
                    className="text-xl font-display tracking-wider"
                    style={{ color: getRiskColor(selectedRegion.risk_score) }}
                  >
                    {selectedRegion.signals_today}
                  </p>
                  <p className="text-[9px] font-mono text-white/35 uppercase">
                    Signals Today
                  </p>
                </div>
                <div className="rounded-sm border border-white/[0.07] p-2.5 text-center">
                  <p
                    className="text-xl font-display tracking-wider"
                    style={{ color: getTrendColor(selectedRegion.trend_delta) }}
                  >
                    {formatTrend(selectedRegion.trend_delta)}
                  </p>
                  <p className="text-[9px] font-mono text-white/35 uppercase">
                    7d Change
                  </p>
                </div>
              </div>

              {/* Top signals */}
              {selectedRegion.top_signals.length > 0 && (
                <div>
                  <p className="text-[10px] font-mono text-white/35 uppercase tracking-wider mb-2">
                    Recent Signals
                  </p>
                  <div className="space-y-2">
                    {selectedRegion.top_signals.map((sig) => (
                      <div
                        key={sig.id}
                        className="p-2.5 rounded-sm border border-white/[0.06] bg-white/[0.02]"
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <SeverityBadge severity={sig.severity} size="sm" />
                          <span className="text-[10px] font-mono text-white/30">
                            {formatRelativeTime(sig.published_at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/65 leading-snug line-clamp-2">
                          {sig.headline}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="p-4">
              <p className="text-[10px] font-mono text-white/35 uppercase tracking-wider mb-3">
                All Flashpoints
              </p>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-sm border border-white/[0.06] bg-white/[0.01] animate-pulse"
                    />
                  ))}
                </div>
              ) : riskScores.length === 0 ? (
                <EmptyState
                  icon={<Globe size={16} />}
                  title="No risk data"
                  description="Risk scores will appear after data bootstrap."
                />
              ) : (
                <div className="space-y-2">
                  {riskScores.map((rs) => {
                    const color = getRiskColor(rs.score);
                    const region = regionRiskData.find((r) => r.region === rs.region);
                    return (
                      <button
                        key={rs.id}
                        onClick={() => {
                          if (region) setSelectedRegion(region);
                        }}
                        disabled={!region}
                        className="w-full text-left p-3 rounded-sm border border-white/[0.06] hover:border-white/[0.12] bg-white/[0.01] hover:bg-white/[0.03] transition-all group disabled:opacity-40"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors">
                            {rs.region}
                          </span>
                          <span
                            className="text-base font-display font-bold"
                            style={{ color }}
                          >
                            {rs.score}
                          </span>
                        </div>
                        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${rs.score}%`, backgroundColor: color, opacity: 0.7 }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[9px] font-mono text-white/30">
                            {rs.signals_today} signals
                          </span>
                          <span
                            className="text-[9px] font-mono"
                            style={{ color: getTrendColor(rs.trend_delta) }}
                          >
                            {formatTrend(rs.trend_delta)} 7d
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
