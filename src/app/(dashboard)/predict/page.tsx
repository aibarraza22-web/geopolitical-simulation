"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, RefreshCw, Zap,
  AlertTriangle, Eye, ChevronRight, Activity, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { cn } from "@/lib/utils";
import type { Prediction, EscalationPath, PredictionAsset, RiskScore } from "@/types";

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#ff3b3b", HIGH: "#ff8c00", MEDIUM: "#f0a500", LOW: "#00e676",
};
const IMPACT_COLORS: Record<string, string> = {
  CATASTROPHIC: "#ff3b3b", SEVERE: "#ff8c00", MODERATE: "#f0a500", LOW: "#00e676",
};
const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "#00e676", MEDIUM: "#f0a500", LOW: "#ff3b3b",
};

function regionToKey(region: string): string {
  return region.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ProbabilityBar({ path, index }: { path: EscalationPath; index: number }) {
  const color = IMPACT_COLORS[path.impact_level] ?? "#6b7280";
  const pct = Math.round(path.probability * 100);
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.07 }} className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[2px]" style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}>
            {path.impact_level}
          </span>
          <span className="text-xs font-semibold text-white/80">{path.label}</span>
          <span className="text-[10px] font-mono text-white/35">· {path.timeframe}</span>
        </div>
        <span className="text-sm font-display tracking-wider" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: index * 0.07 + 0.1, ease: "easeOut" }} />
      </div>
      <p className="text-[11px] text-white/45 leading-relaxed">{path.description}</p>
      {path.asset_impacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {path.asset_impacts.map((ai, i) => (
            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] flex items-center gap-1"
              style={{ color: ai.direction === "up" ? "#00e676" : "#ff3b3b", backgroundColor: ai.direction === "up" ? "#00e67615" : "#ff3b3b15", border: `1px solid ${ai.direction === "up" ? "#00e67630" : "#ff3b3b30"}` }}>
              {ai.direction === "up" ? "↑" : "↓"} {ai.asset}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function AssetRow({ asset }: { asset: PredictionAsset }) {
  const color = asset.direction === "up" ? "#00e676" : "#ff3b3b";
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center justify-center w-6 h-6 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: `${color}15` }}>
        {asset.direction === "up" ? <TrendingUp size={12} style={{ color }} /> : <TrendingDown size={12} style={{ color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold text-white/85 font-mono">{asset.asset}</span>
          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-[2px]" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>{asset.magnitude}</span>
        </div>
        <p className="text-[11px] text-white/45 leading-relaxed">{asset.rationale}</p>
      </div>
    </div>
  );
}

function PredictionListItem({ prediction, selected, onSelect }: { prediction: Prediction; selected: boolean; onSelect: () => void }) {
  const severityColor = SEVERITY_COLORS[prediction.severity] ?? "#6b7280";
  const confidenceColor = CONFIDENCE_COLORS[prediction.confidence] ?? "#6b7280";
  return (
    <button onClick={onSelect} className={cn("w-full text-left p-3.5 border-b border-white/[0.05] transition-all relative group", selected ? "bg-axiom-amber/[0.06] border-l-2 border-l-axiom-amber" : "hover:bg-white/[0.03] border-l-2 border-l-transparent")}>
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: severityColor }} />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-bold text-white/90 font-ui leading-tight">{prediction.flashpoint}</span>
          <div className="text-right shrink-0">
            <span className="text-2xl font-display tracking-wider leading-none" style={{ color: severityColor }}>{prediction.probability}%</span>
            <p className="text-[9px] font-mono text-white/30 mt-0.5">escalation risk</p>
          </div>
        </div>
        <p className="text-[11px] text-white/50 leading-snug mb-2 line-clamp-2">{prediction.headline}</p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]" style={{ color: confidenceColor, backgroundColor: `${confidenceColor}18`, border: `1px solid ${confidenceColor}40` }}>{prediction.confidence}</span>
          <span className="text-[9px] font-mono text-white/30 flex items-center gap-1"><Clock size={8} />{prediction.timeframe}</span>
        </div>
      </div>
      {selected && <ChevronRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-axiom-amber" />}
    </button>
  );
}

function PredictionDetail({ prediction, onRegenerate, regenerating }: { prediction: Prediction; onRegenerate: (flashpoint: string, regionKey: string) => Promise<void>; regenerating: boolean }) {
  const severityColor = SEVERITY_COLORS[prediction.severity] ?? "#6b7280";
  return (
    <motion.div key={prediction.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest mb-1" style={{ color: severityColor }}>{prediction.severity} RISK</p>
              <h2 className="font-display text-2xl tracking-widest text-white">{prediction.flashpoint.toUpperCase()}</h2>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-mono text-white/40 mb-0.5 uppercase tracking-widest">Escalation probability</p>
              <p className="font-display text-5xl tracking-wider leading-none" style={{ color: severityColor }}>{prediction.probability}%</p>
              <p className="text-[10px] font-mono text-white/40 mt-1">within {prediction.timeframe}</p>
            </div>
          </div>
          <div className="px-4 py-3 rounded-sm border" style={{ backgroundColor: `${severityColor}08`, borderColor: `${severityColor}30` }}>
            <p className="text-sm font-semibold text-white/90 leading-snug">{prediction.headline}</p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-[2px]" style={{ color: CONFIDENCE_COLORS[prediction.confidence], backgroundColor: `${CONFIDENCE_COLORS[prediction.confidence]}15`, border: `1px solid ${CONFIDENCE_COLORS[prediction.confidence]}40` }}>{prediction.confidence} CONFIDENCE</span>
            <span className="text-[10px] font-mono text-white/35">{prediction.signal_count} signals analyzed</span>
            <span className="text-[10px] font-mono text-white/25">Generated {new Date(prediction.generated_at).toLocaleTimeString()}</span>
          </div>
        </div>

        <div className="rounded-sm border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
            <Activity size={13} className="text-axiom-cyan" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Intelligence Assessment</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {prediction.narrative.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-white/75 leading-relaxed font-ui">{para}</p>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
            <TrendingUp size={13} className="text-axiom-amber" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Escalation Scenarios</span>
            <span className="ml-auto text-[10px] font-mono text-white/30">{prediction.escalation_paths.length} paths</span>
          </div>
          <div className="px-4 py-4">
            {prediction.escalation_paths.map((path, i) => <ProbabilityBar key={i} path={path} index={i} />)}
          </div>
        </div>

        <div className="rounded-sm border border-axiom-red/20 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
            <Eye size={13} className="text-axiom-red" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-axiom-red/70">Key Indicators to Monitor</span>
          </div>
          <div className="px-4 py-3">
            <ul className="space-y-2">
              {prediction.key_indicators.map((indicator, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-axiom-red font-mono text-[10px] mt-0.5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-xs text-white/70 leading-snug">{indicator}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {prediction.affected_assets.length > 0 && (
          <div className="rounded-sm border border-white/[0.07] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center gap-2">
              <AlertTriangle size={13} className="text-axiom-green" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/60">Affected Assets</span>
            </div>
            <div className="px-4 py-1">
              {prediction.affected_assets.map((asset) => <AssetRow key={asset.asset} asset={asset} />)}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} loading={regenerating} onClick={() => onRegenerate(prediction.flashpoint, prediction.region_key)}>
            Regenerate Prediction
          </Button>
          <p className="text-[10px] font-mono text-white/25 mt-2">Next auto-refresh: {new Date(prediction.next_update).toLocaleTimeString()}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function PredictPage() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  // Flashpoints derived from risk_scores in DB — not hardcoded
  const [flashpoints, setFlashpoints] = useState<{ flashpoint: string; region_key: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing predictions + derive flashpoints from DB risk_scores
  const fetchAll = useCallback(async () => {
    try {
      const [predsRes, riskRes] = await Promise.all([
        fetch("/api/predictions"),
        fetch("/api/risk-scores"),
      ]);
      const predsJson = (await predsRes.json()) as { predictions?: Prediction[]; error?: string };
      const riskJson = (await riskRes.json()) as { data?: RiskScore[] };

      if (predsJson.predictions) {
        const sorted = predsJson.predictions.sort((a, b) => b.probability - a.probability);
        setPredictions(sorted);
        if (sorted.length > 0 && !selected) setSelected(sorted[0]);
      }

      // Build flashpoint list from whatever regions are in the DB
      if (riskJson.data && riskJson.data.length > 0) {
        const fps = riskJson.data.map((rs) => ({
          flashpoint: rs.region,
          region_key: regionToKey(rs.region),
        }));
        setFlashpoints(fps);
      }
    } catch {
      setError("Failed to load predictions.");
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleGenerateAll = async () => {
    if (flashpoints.length === 0) {
      setError("No flashpoints found. Run the data bootstrap first.");
      return;
    }
    setGenerating(true);
    setError(null);

    for (const fp of flashpoints) {
      setGenerateProgress(`Analyzing: ${fp.flashpoint}...`);
      try {
        const res = await fetch("/api/predictions/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fp),
        });
        const json = (await res.json()) as { prediction?: Prediction; error?: string };
        if (json.prediction) {
          setPredictions((prev) => {
            const idx = prev.findIndex((p) => p.flashpoint === json.prediction!.flashpoint);
            const next = idx >= 0 ? prev.map((p, i) => i === idx ? json.prediction! : p) : [...prev, json.prediction!];
            return next.sort((a, b) => b.probability - a.probability);
          });
          if (!selected) setSelected(json.prediction);
        } else if (json.error) {
          console.error(`Prediction error for ${fp.flashpoint}:`, json.error);
        }
      } catch (e) {
        console.error(`Failed generating ${fp.flashpoint}:`, e);
      }
    }

    setGenerateProgress(null);
    setGenerating(false);
  };

  const handleRegenerate = async (flashpoint: string, regionKey: string) => {
    const pred = predictions.find((p) => p.flashpoint === flashpoint);
    if (pred) setRegeneratingId(pred.id);
    try {
      const res = await fetch("/api/predictions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flashpoint, region_key: regionKey }),
      });
      const json = (await res.json()) as { prediction?: Prediction; error?: string };
      if (json.prediction) {
        setPredictions((prev) => prev.map((p) => p.flashpoint === json.prediction!.flashpoint ? json.prediction! : p).sort((a, b) => b.probability - a.probability));
        setSelected(json.prediction);
      }
    } catch {
      console.error("Regenerate failed");
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-[320px] shrink-0 border-r border-white/[0.07] flex flex-col">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70 font-ui">Active Predictions</span>
            <LiveIndicator />
          </div>
          <span className="text-[10px] font-mono text-white/30">{predictions.length}/{flashpoints.length || "?"}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center gap-2 text-white/40">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-xs font-mono">Loading...</span>
              </div>
            </div>
          ) : predictions.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-axiom-amber/10 border border-axiom-amber/20 flex items-center justify-center mx-auto mb-3">
                <Zap size={16} className="text-axiom-amber" />
              </div>
              <p className="text-xs font-semibold text-white/60 mb-1">No predictions yet</p>
              <p className="text-[11px] text-white/35 mb-4">
                Generate autonomous AI intelligence assessments for all active flashpoints from live signals.
              </p>
              <Button variant="primary" size="sm" onClick={handleGenerateAll} loading={generating} icon={<Zap size={12} />}>
                Generate All
              </Button>
            </div>
          ) : (
            predictions.map((p) => (
              <PredictionListItem key={p.id} prediction={p} selected={selected?.id === p.id} onSelect={() => setSelected(p)} />
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.07] flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-display text-xl tracking-widest text-white">AXIOM PREDICTIONS</h1>
            <p className="text-[10px] font-mono text-white/35 mt-0.5">
              Autonomous forward-looking intelligence · {flashpoints.length} flashpoints monitored
            </p>
          </div>
          <div className="flex items-center gap-3">
            {generateProgress && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] font-mono text-axiom-amber">
                {generateProgress}
              </motion.span>
            )}
            {error && <span className="text-[10px] font-mono text-axiom-red">{error}</span>}
            <Button variant="primary" size="sm" icon={<Zap size={12} />} onClick={handleGenerateAll} loading={generating}>
              {generating ? "Analyzing..." : "Generate All Predictions"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {selected ? (
              <PredictionDetail key={selected.id} prediction={selected} onRegenerate={handleRegenerate} regenerating={regeneratingId === selected.id} />
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-14 h-14 rounded-full bg-axiom-amber/10 border border-axiom-amber/20 flex items-center justify-center mb-4">
                  <Activity size={22} className="text-axiom-amber" />
                </div>
                <p className="font-display text-xl tracking-widest text-white mb-2">SELECT A FLASHPOINT</p>
                <p className="text-sm text-white/40 max-w-sm">
                  Click a flashpoint from the left panel to view its full intelligence assessment, or click &quot;Generate All&quot; to run AXIOM&apos;s analysis on all active regions.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
