"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { SimOutput } from "./SimOutput";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RotateCcw, Download, History, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import type { SimulationConfig, SimulationOutput, Scenario } from "@/types";

type PanelState = "idle" | "streaming" | "complete" | "error";

export function SimulatorPanel() {
  const [state, setState] = useState<PanelState>("idle");
  const [streamingText, setStreamingText] = useState("");
  const [output, setOutput] = useState<SimulationOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Scenario[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Load simulation history from Supabase
  useEffect(() => {
    if (!showHistory) return;

    setHistoryLoading(true);
    const supabase = createClient();

    supabase
      .from("scenarios")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setHistory((data ?? []) as Scenario[]);
        setHistoryLoading(false);
      })
      .catch(() => {
        setHistoryLoading(false);
      });
  }, [showHistory]);

  const handleSimulate = async (config: SimulationConfig) => {
    setState("streaming");
    setStreamingText("");
    setOutput(null);
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

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

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
              setOutput(parsed.output);
              setState("complete");
            } else if (parsed.type === "error") {
              throw new Error(parsed.error ?? "Stream error");
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }

      if (!output && accumulated) {
        setState("complete");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState("idle");
      } else {
        setError((err as Error).message);
        setState("error");
      }
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setState("idle");
    setStreamingText("");
    setOutput(null);
    setError(null);
  };

  const handleLoadScenario = (scenario: Scenario) => {
    if (scenario.output) {
      setOutput(scenario.output);
      setState("complete");
      setShowHistory(false);
    }
  };

  return (
    <div className="flex gap-0 h-full">
      {/* Left: Config Panel */}
      <div className="w-[340px] shrink-0 border-r border-white/[0.07] overflow-y-auto">
        <div className="p-5">
          <div className="mb-5">
            <h2 className="font-display text-2xl tracking-widest text-white">
              SCENARIO BUILDER
            </h2>
            <p className="text-xs text-white/40 mt-1 font-ui">
              Configure geopolitical scenario parameters for AI-powered analysis
            </p>
          </div>

          <ScenarioBuilder
            onSubmit={handleSimulate}
            isLoading={state === "streaming"}
          />

          {/* History */}
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
                        onClick={() => handleLoadScenario(s)}
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
        </div>
      </div>

      {/* Right: Output Panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full min-h-[500px] text-center px-8"
            >
              <EmptyState
                icon={<Zap size={20} />}
                title="Awaiting Input"
                description="Configure a scenario in the panel on the left and click Run Simulation to generate AI-powered analysis."
              />
            </motion.div>
          )}

          {state === "streaming" && (
            <motion.div
              key="streaming"
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
                      AXIOM ANALYZING...
                    </p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      claude-sonnet-4-5 · Streaming response
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleReset}
                  className="text-white/40"
                >
                  Cancel
                </Button>
              </div>

              {streamingText && (
                <div className="rounded-sm border border-white/[0.07] p-4">
                  <p className="text-sm text-white/70 leading-relaxed font-ui streaming-cursor whitespace-pre-wrap">
                    {streamingText}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {state === "complete" && output && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-axiom-green font-mono tracking-wider">
                    SIMULATION COMPLETE
                  </p>
                  <p className="text-[10px] text-white/35 mt-0.5">
                    Analysis generated by AXIOM AI
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

              <SimOutput output={output} />
            </motion.div>
          )}

          {state === "error" && (
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
