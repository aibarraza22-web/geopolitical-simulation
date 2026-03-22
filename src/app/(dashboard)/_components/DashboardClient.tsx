"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Activity, AlertTriangle, Radio, Globe, Brain, TrendingUp, Clock, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignalFeed } from "@/components/feed/SignalFeed";
import { WorldMap } from "@/components/map/WorldMap";
import { Button } from "@/components/ui/Button";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { getRiskColor } from "@/lib/utils";
import type { Signal, RiskScore, Scenario, RegionRiskData, Prediction } from "@/types";
import { getCentroidFromCountryCodes } from "@/lib/country-coords";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ff3b3b",
  HIGH: "#ff8c00",
  MEDIUM: "#f0a500",
  LOW: "#00e676",
};

// Derive map coordinates dynamically from country_codes stored in DB
function toRegionRiskData(rs: RiskScore): RegionRiskData | null {
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
  };
}

interface DashboardClientProps {
  riskScores: RiskScore[];
  recentSignals: Signal[];
  signalsToday: number;
  scenarios: Scenario[];
}

function PredictionCard({
  prediction,
  onClick,
}: {
  prediction: Prediction;
  onClick: () => void;
}) {
  const severityColor = SEVERITY_COLORS[prediction.severity] ?? "#6b7280";
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-sm border border-white/[0.07] hover:border-axiom-amber/30 hover:bg-axiom-amber/[0.03] transition-all group relative overflow-hidden"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm"
        style={{ backgroundColor: severityColor }}
      />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
            {prediction.flashpoint}
          </p>
          <div className="text-right shrink-0">
            <span
              className="text-2xl font-display tracking-wider leading-none"
              style={{ color: severityColor }}
            >
              {prediction.probability}%
            </span>
            <p className="text-[9px] font-mono text-white/30 mt-0.5">escalation risk</p>
          </div>
        </div>
        <p className="text-xs font-semibold text-white/80 leading-snug mb-2 line-clamp-2">
          {prediction.headline}
        </p>
        <div className="flex items-center gap-2">
          <span
            className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]"
            style={{
              color: severityColor,
              backgroundColor: `${severityColor}15`,
              border: `1px solid ${severityColor}40`,
            }}
          >
            {prediction.severity}
          </span>
          <span className="text-[9px] font-mono text-white/30 flex items-center gap-1">
            <Clock size={8} />
            {prediction.timeframe}
          </span>
        </div>
      </div>
    </button>
  );
}

export function DashboardClient({
  riskScores,
  recentSignals,
  signalsToday,
  scenarios,
}: DashboardClientProps) {
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);
  const [topPredictions, setTopPredictions] = useState<Prediction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    // Trigger a background signal refresh via cron endpoint (no-op if recent)
    void fetch("/api/cron").catch(() => {});

    // Load predictions
    const loadPredictions = () => {
      fetch("/api/predictions")
        .then((r) => r.json())
        .then((json: { predictions?: Prediction[] }) => {
          if (json.predictions) setTopPredictions(json.predictions.slice(0, 3));
        })
        .catch(() => {});
    };
    loadPredictions();

    // Auto-refresh signals every 15 minutes while tab is open
    const interval = setInterval(() => {
      void fetch("/api/cron").catch(() => {});
      loadPredictions();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const hasData = riskScores.length > 0 || recentSignals.length > 0;

  // Compute KPIs from real data
  const globalRiskIndex =
    riskScores.length > 0
      ? Math.round(
          riskScores.reduce((sum, rs) => sum + rs.score, 0) / riskScores.length
        )
      : 0;

  const activeFlashpoints = riskScores.filter((rs) => rs.score > 60).length;
  const activeSimulations = scenarios.filter(
    (s) => s.status === "running" || s.status === "pending"
  ).length;
  void activeSimulations; // kept for backward compat

  const regionRiskData = riskScores
    .map(toRegionRiskData)
    .filter((r): r is RegionRiskData => r !== null);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapMsg(null);
    try {
      const res = await fetch("/api/bootstrap", { method: "POST" });
      const json = (await res.json()) as { message?: string; error?: string };
      setBootstrapMsg(json.message ?? json.error ?? "Bootstrap triggered.");
    } catch {
      setBootstrapMsg("Failed to trigger bootstrap. Check your connection.");
    } finally {
      setBootstrapping(false);
    }
  };

  const handleRefreshFeed = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/cron?force=true");
      setLastRefreshed(new Date());
      router.refresh();
    } catch {
      // silently fail
    } finally {
      setRefreshing(false);
    }
  };

  const kpis = [
    {
      label: "Global Risk Index",
      value: globalRiskIndex > 0 ? String(globalRiskIndex) : "—",
      sub: "Composite average",
      color: getRiskColor(globalRiskIndex),
      icon: Activity,
    },
    {
      label: "Active Flashpoints",
      value: String(activeFlashpoints),
      sub: "Risk score > 60",
      color: "#f0a500",
      icon: AlertTriangle,
    },
    {
      label: "Signals Today",
      value: String(signalsToday),
      sub: "Ingested since midnight",
      color: "#00d4ff",
      icon: Radio,
    },
    {
      label: "Active Predictions",
      value: String(topPredictions.length > 0 ? 8 : 0),
      sub: "Flashpoints monitored",
      color: "#a855f7",
      icon: Brain,
    },
  ];

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="font-display text-3xl tracking-widest text-white">
            AXIOM DASHBOARD
          </h1>
          <p className="text-xs text-white/40 mt-0.5 font-mono">
            Real-time geopolitical intelligence overview
          </p>
        </div>
        {!hasData && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleBootstrap}
            loading={bootstrapping}
          >
            Initialize Data Feed
          </Button>
        )}
      </motion.div>

      {/* Bootstrap status */}
      {bootstrapMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-2.5 rounded-sm border border-axiom-cyan/30 bg-axiom-cyan/5 text-xs font-mono text-axiom-cyan"
        >
          {bootstrapMsg}
        </motion.div>
      )}

      {/* KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {kpis.map((kpi) => (
          <Card key={kpi.label} accentColor={kpi.color}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={13} style={{ color: kpi.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 font-ui">
                {kpi.label}
              </span>
            </div>
            <p
              className="font-display text-4xl tracking-wider"
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </p>
            <p className="text-[10px] font-mono text-white/30 mt-1">{kpi.sub}</p>
          </Card>
        ))}
      </motion.div>

      {/* World Map — full width */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card padding="none" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 font-ui">
              Global Risk Map
            </span>
            {riskScores.length === 0 && (
              <span className="text-[10px] font-mono text-white/25">
                Initializing data feed...
              </span>
            )}
          </div>
          {riskScores.length === 0 ? (
            <EmptyState
              icon={<Globe size={20} />}
              title="Initializing data feed"
              description="Run the data bootstrap to populate risk scores and signals."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleBootstrap}
                  loading={bootstrapping}
                >
                  Bootstrap Now
                </Button>
              }
            />
          ) : (
            <WorldMap riskScores={regionRiskData} height={520} />
          )}
        </Card>
      </motion.div>

      {/* Live Signal Feed — full width below map */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
      >
        <Card padding="none" className="overflow-hidden" style={{ maxHeight: 480 }}>
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio size={12} className="text-axiom-cyan" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 font-ui">
                Live Signal Feed
              </span>
              <LiveIndicator />
              {lastRefreshed && (
                <span className="text-[9px] font-mono text-white/25">
                  Updated {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={() => void handleRefreshFeed()}
              disabled={refreshing}
              className="flex items-center gap-1 text-[10px] font-mono text-axiom-cyan hover:text-axiom-cyan/80 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Fetching..." : "Refresh"}
            </button>
          </div>
          <SignalFeed
            signals={recentSignals}
            title=""
            maxItems={30}
            showFilters={true}
          />
        </Card>
      </motion.div>

      {/* Live Predictions — top 3 highest probability */}
      {topPredictions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          <Card padding="none">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={13} className="text-axiom-amber" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 font-ui">
                  Live Predictions
                </span>
                <LiveIndicator />
              </div>
              <button
                onClick={() => router.push("/predict")}
                className="text-[10px] font-mono text-axiom-cyan hover:text-axiom-cyan/80 transition-colors flex items-center gap-1"
              >
                View All <TrendingUp size={10} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
              {topPredictions.map((p) => (
                <PredictionCard
                  key={p.id}
                  prediction={p}
                  onClick={() => router.push("/predict")}
                />
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Region risk scores row */}
      {riskScores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card padding="none">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60 font-ui">
                Monitored Flashpoints
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-white/[0.05]">
              {riskScores.map((rs) => {
                const color = getRiskColor(rs.score);
                return (
                  <div key={rs.id} className="px-4 py-3">
                    <p className="text-[10px] font-mono text-white/40 mb-1 truncate">
                      {rs.region}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xl font-display tracking-wider"
                        style={{ color }}
                      >
                        {rs.score}
                      </span>
                      <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${rs.score}%`, backgroundColor: color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                    <p className="text-[9px] font-mono text-white/25 mt-0.5">
                      {rs.signals_today} signals today
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
