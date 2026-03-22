"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { SimOutput } from "./SimOutput";
import { MonteCarloOutput } from "./MonteCarloOutput";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RotateCcw, Download, History, Zap, GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { SimulationConfig, SimulationOutput, Scenario } from "@/types";
import type { MonteCarloResponse } from "@/app/api/simulate/monte-carlo/route";

type PanelState = "idle" | "running" | "complete" | "error";
type SimMode = "ai" | "montecarlo";

const FLASHPOINTS = [
  { label: "Taiwan Strait", value: "Taiwan Strait", key: "taiwan-strait" },
  { label: "Iran–Israel", value: "Iran-Israel", key: "iran-israel" },
  { label: "Ukraine–Russia", value: "Ukraine-Russia", key: "ukraine-russia" },
  { label: "North Korea", value: "Korean Peninsula", key: "korean-peninsula" },
  { label: "South China Sea", value: "South China Sea", key: "south-china-sea" },
  { label: "India–Pakistan", value: "India-Pakistan", key: "india-pakistan" },
];

const HORIZON_OPTIONS = ["24h", "7d", "30d", "90d", "1y"] as const;

export function SimulatorPanel() {
  const [mode, setMode] = useState<SimMode>("ai");

  // AI mode state
  const [aiState, setAiState] = useState<PanelState>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [aiOutput, setAiOutput] = useState<SimulationOutput | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Monte Carlo mode state
  const [mcState, setMcState] = useState<PanelState>("idle");
  const [mcOutput, setMcOutput] = useState<MonteCarloResponse | null>(null);
  const [mcFlashpoint, setMcFlashpoint] = useState(FLASHPOINTS[0]);
  const [mcHorizon, setMcHorizon] = useState<string>("30d");
  const [mcActors, setMcActors] = useState("");
  const [mcSims, setMcSims] = useState(10000);

  // Shared error + history
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Scenario[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (!showHistory) return;
    setHistoryLoading(true);
    const supabase = createClient();
    void supabase
      .from("scenarios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setHistory((data ?? []) as Scenario[]);
        setHistoryLoading(false);
      });
  }, [showHistory]);

  // ── AI simulation ──────────────────────────────────────────────────────────
  const handleSimulate = async (config: SimulationConfig) => {
    setAiState("running");
    setStreamingText("");
    setAiOutput(null);
    setError(null);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "Simulation failed");
      }
      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data) as {
              type: string;
              content?: string;
              output?: SimulationOutput;
              error?: string;
            };
            if (parsed.type === "delta" && parsed.content) {
              accumulated += parsed.content;
              setStreamingText(accumulated);
            } else if (parsed.type === "complete" && parsed.output) {
              setAiOutput(parsed.output);
              setAiState("complete");
            } else if (parsed.type === "error") {
              throw new Error(parsed.error ?? "Stream error");
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
      if (!aiOutput && accumulated) setAiState("complete");
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setAiState("idle");
      } else {
        setError((err as Error).message);
        setAiState("error");
      }
    }
  };

  // ── Monte Carlo simulation ─────────────────────────────────────────────────
  const handleMonteCarlo = async () => {
    setMcState("running");
    setMcOutput(null);
    setError(null);

    try {
      const actors = mcActors
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await fetch("/api/simulate/monte-carlo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashpoint: mcFlashpoint.value,
          region_key: mcFlashpoint.key,
          time_horizon: mcHorizon,
          actors,
          sim_count: mcSims,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Monte Carlo failed");
      }

      const data = (await res.json()) as MonteCarloResponse;
      setMcOutput(data);
      setMcState("complete");
    } catch (err) {
      setError((err as Error).message);
      setMcState("error");
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setAiState("idle");
    setMcState("idle");
    setStreamingText("");
    setAiOutput(null);
    setMcOutput(null);
    setError(null);
  };

  const activeState = mode === "ai" ? aiState : mcState;

  return (
    <div className="flex gap-0 h-full">
      {/* Left: Config Panel */}
      <div className="w-[340px] shrink-0 border-r border-white/[0.07] overflow-y-auto">
        <div className="p-5">
          <div className="mb-4">
            <h2 className="font-display text-2xl tracking-widest text-white">
              SCENARIO BUILDER
            </h2>
            <p className="text-xs text-white/40 mt-1 font-ui">
              Configure geopolitical scenario parameters
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-[3px] bg-white/[0.04] border border-white/[0.07] mb-5">
            <button
              onClick={() => setMode("ai")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[2px] text-[11px] font-semibold transition-all ${
                mode === "ai"
                  ? "bg-axiom-amber/20 text-axiom-amber border border-axiom-amber/40"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <Zap size={11} />
              AI Analysis
            </button>
            <button
              onClick={() => setMode("montecarlo")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[2px] text-[11px] font-semibold transition-all ${
                mode === "montecarlo"
                  ? "bg-axiom-cyan/20 text-axiom-cyan border border-axiom-cyan/40"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <GitBranch size={11} />
              Monte Carlo
            </button>
          </div>

          {/* AI mode config */}
          {mode === "ai" && (
            <ScenarioBuilder
              onSubmit={handleSimulate}
              isLoading={aiState === "running"}
            />
          )}

          {/* Monte Carlo mode config */}
          {mode === "montecarlo" && (
            <div className="space-y-4">
              <div>
                <label className="axiom-label">Flashpoint</label>
                <select
                  className="axiom-select"
                  value={mcFlashpoint.value}
                  onChange={(e) =>
                    setMcFlashpoint(
                      FLASHPOINTS.find((f) => f.value === e.target.value) ??
                        FLASHPOINTS[0]
                    )
                  }
                >
                  {FLASHPOINTS.map((f) => (
                    <option key={f.key} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="axiom-label">Time Horizon</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {HORIZON_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setMcHorizon(h)}
                      className={`py-1.5 rounded-[2px] text-[11px] font-semibold uppercase tracking-wider border transition-all font-ui ${
                        mcHorizon === h
                          ? "bg-axiom-cyan/20 text-axiom-cyan border-axiom-cyan/50"
                          : "bg-white/[0.04] text-white/40 border-white/[0.08] hover:border-white/[0.15] hover:text-white/60"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="axiom-label">Actors (optional)</label>
                <input
                  className="axiom-input"
                  placeholder="e.g. China, USA, Taiwan"
                  value={mcActors}
                  onChange={(e) => setMcActors(e.target.value)}
                />
                <p className="text-[10px] text-white/25 mt-1">
                  Leave blank to auto-detect from flashpoint
                </p>
              </div>

              <div>
                <label className="axiom-label">
                  Simulations:{" "}
                  <span className="text-axiom-cyan">
                    {mcSims.toLocaleString()}
                  </span>
                </label>
                <input
                  type="range"
                  min={1000}
                  max={50000}
                  step={1000}
                  value={mcSims}
                  onChange={(e) => setMcSims(Number(e.target.value))}
                  className="w-full accent-axiom-cyan"
                />
                <div className="flex justify-between text-[9px] text-white/25 font-mono mt-0.5">
                  <span>1K</span>
                  <span>50K</span>
                </div>
              </div>

              <Button
                variant="primary"
                fullWidth
                loading={mcState === "running"}
                icon={<GitBranch size={14} />}
                onClick={() => void handleMonteCarlo()}
                className="mt-2 !bg-axiom-cyan/20 !border-axiom-cyan/40 !text-axiom-cyan hover:!bg-axiom-cyan/30"
              >
                {mcState === "running"
                  ? `Running ${mcSims.toLocaleString()} simulations...`
                  : "Run Monte Carlo"}
              </Button>
            </div>
          )}

          {/* History — only for AI mode */}
          {mode === "ai" && (
            <div className="mt-5 pt-4 border-t border-white/[0.07]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                  Recent Simulations
                </span>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="text-[10px] text-axiom-cyan hover:text-axiom-cyan/80 transition-colors flex items-center gap-1"
                >
                  <History size={10} />
                  {showHistory ? "Hide" : "View"}
                </button>
              </div>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-2"
                  >
                    {historyLoading && (
                      <p className="text-[10px] font-mono text-white/30 py-2 text-center">
                        Loading...
                      </p>
                    )}
                    {!historyLoading && history.length === 0 && (
                      <p className="text-[10px] font-mono text-white/25 py-2 text-center">
                        No simulations yet
                      </p>
                    )}
                    {!historyLoading &&
                      history.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            if (s.output) {
                              setAiOutput(s.output);
                              setAiState("complete");
                              setShowHistory(false);
                            }
                          }}
                          disabled={!s.output}
                          className="w-full text-left p-2.5 rounded-[3px] border border-white/[0.06] hover:border-axiom-amber/30 hover:bg-axiom-amber/[0.04] transition-all group disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <p className="text-[11px] font-semibold text-white/70 group-hover:text-white/90 transition-colors leading-tight">
                            {s.name}
                          </p>
                          <p className="text-[10px] text-white/35 mt-0.5 font-mono">
                            {s.config.domain} · {s.config.time_horizon} ·{" "}
                            {formatRelativeTime(s.created_at)}
                          </p>
                        </button>
                      ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Right: Output Panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-8"
            >
              <EmptyState
                icon={
                  mode === "montecarlo" ? (
                    <GitBranch size={20} />
                  ) : (
                    <Zap size={20} />
                  )
                }
                title="Awaiting Input"
                description={
                  mode === "montecarlo"
                    ? "Select a flashpoint and run Monte Carlo to simulate thousands of conflict trajectories using Markov Chain state transitions."
                    : "Configure a scenario in the panel on the left and click Run Simulation to generate AI-powered analysis."
                }
              />
            </motion.div>
          )}

          {activeState === "running" && (
            <motion.div
              key="running"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <LoadingSpinner size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-axiom-amber font-mono tracking-wider">
                      {mode === "montecarlo"
                        ? `RUNNING ${mcSims.toLocaleString()} SIMULATIONS...`
                        : "AXIOM ANALYZING..."}
                    </p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      {mode === "montecarlo"
                        ? "Markov Chain · Multi-Agent Layer · Monte Carlo"
                        : "claude-sonnet-4-6 · Streaming response"}
                    </p>
                  </div>
                </div>
                {mode === "ai" && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleReset}
                    className="text-white/40"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {mode === "ai" && streamingText && (
                <div className="rounded-sm border border-white/[0.07] p-4">
                  <p className="text-sm text-white/70 leading-relaxed font-ui streaming-cursor whitespace-pre-wrap">
                    {streamingText}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeState === "complete" &&
            (mode === "ai" ? aiOutput : mcOutput) && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-axiom-green font-mono tracking-wider">
                      {mode === "montecarlo"
                        ? "MONTE CARLO COMPLETE"
                        : "SIMULATION COMPLETE"}
                    </p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      {mode === "montecarlo"
                        ? `${mcSims.toLocaleString()} simulations · Markov Chain · Multi-Agent`
                        : "Analysis generated by AXIOM AI"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="xs"
                      icon={<Download size={11} />}
                    >
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      icon={<RotateCcw size={11} />}
                      onClick={handleReset}
                    >
                      New
                    </Button>
                  </div>
                </div>

                {mode === "ai" && aiOutput && <SimOutput output={aiOutput} />}
                {mode === "montecarlo" && mcOutput && (
                  <MonteCarloOutput data={mcOutput} />
                )}
              </motion.div>
            )}

          {activeState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full min-h-[400px] p-8"
            >
              <div className="w-10 h-10 rounded-full bg-axiom-red/15 border border-axiom-red/30 flex items-center justify-center mb-4">
                <span className="text-axiom-red font-bold">!</span>
              </div>
              <p className="text-sm font-semibold text-axiom-red mb-1">
                Simulation Error
              </p>
              <p className="text-xs text-white/40 text-center max-w-sm mb-4">
                {error ?? "An unexpected error occurred. Please try again."}
              </p>
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Try Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
