"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, RefreshCw, Radio } from "lucide-react";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignalItem } from "./SignalItem";
import { createClient } from "@/lib/supabase/client";
import type { Signal, SignalSeverity, SignalDomain } from "@/types";
import { cn } from "@/lib/utils";

const SEVERITY_FILTERS: { label: string; value: SignalSeverity | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Critical", value: "CRITICAL" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
];

interface SignalFeedProps {
  signals: Signal[];
  maxItems?: number;
  compact?: boolean;
  title?: string;
  showFilters?: boolean;
}

export function SignalFeed({
  signals: initialSignals,
  maxItems = 20,
  compact = false,
  title = "Signal Feed",
  showFilters = true,
}: SignalFeedProps) {
  const [signals, setSignals] = useState<Signal[]>(initialSignals.slice(0, maxItems));
  const [severityFilter, setSeverityFilter] = useState<SignalSeverity | "ALL">("ALL");
  const [domainFilter, setDomainFilter] = useState<SignalDomain | "ALL">("ALL");
  const [newCount, setNewCount] = useState(0);
  const [isLive, setIsLive] = useState(true);

  // Sync when parent prop changes (e.g., page refresh)
  useEffect(() => {
    setSignals(initialSignals.slice(0, maxItems));
  }, [initialSignals, maxItems]);

  // Supabase Realtime subscription for live signal inserts
  useEffect(() => {
    if (!isLive) return;

    const supabase = createClient();

    const channel = supabase
      .channel("signals-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          const newSignal = payload.new as Signal;
          setSignals((prev) => [newSignal, ...prev.slice(0, maxItems - 1)]);
          setNewCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isLive, maxItems]);

  const filteredSignals = signals.filter((s) => {
    if (severityFilter !== "ALL" && s.severity !== severityFilter) return false;
    if (domainFilter !== "ALL" && s.domain !== domainFilter) return false;
    return true;
  });

  const handleRefresh = useCallback(() => {
    setNewCount(0);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-white/60 font-ui">
            {title}
          </h3>
          {isLive && <LiveIndicator />}
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleRefresh}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-axiom-cyan bg-axiom-cyan/10 border border-axiom-cyan/30 rounded-[2px] hover:bg-axiom-cyan/20 transition-colors"
            >
              <RefreshCw size={9} />
              {newCount} new
            </motion.button>
          )}
          <button
            onClick={() => setIsLive(!isLive)}
            className={cn(
              "p-1.5 rounded-sm transition-colors",
              isLive
                ? "text-axiom-green/60 hover:text-axiom-green"
                : "text-white/30 hover:text-white/60"
            )}
            title={isLive ? "Pause live feed" : "Resume live feed"}
          >
            <div
              className={cn(
                "w-2 h-2 rounded-sm",
                isLive ? "bg-axiom-green" : "bg-white/30"
              )}
            />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.05] shrink-0 overflow-x-auto">
          <Filter size={10} className="text-white/30 shrink-0" />
          <div className="flex items-center gap-1">
            {SEVERITY_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSeverityFilter(f.value)}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-[2px] transition-colors whitespace-nowrap",
                  severityFilter === f.value
                    ? "bg-axiom-amber/20 text-axiom-amber border border-axiom-amber/40"
                    : "text-white/40 hover:text-white/60 border border-transparent"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-white/[0.07] mx-1 shrink-0" />
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value as SignalDomain | "ALL")}
            className="text-[10px] bg-transparent text-white/40 border-none outline-none cursor-pointer"
          >
            <option value="ALL">All Domains</option>
            <option value="Military">Military</option>
            <option value="Financial">Financial</option>
            <option value="Political">Political</option>
            <option value="Trade">Trade</option>
            <option value="Energy">Energy</option>
            <option value="Humanitarian">Humanitarian</option>
          </select>
        </div>
      )}

      {/* Signal list */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filteredSignals.length === 0 ? (
            <EmptyState
              icon={<Radio size={20} />}
              title="No signals yet"
              description="Signal feed is initializing. Live updates will appear here automatically."
            />
          ) : (
            filteredSignals.map((signal, i) => (
              <SignalItem
                key={signal.id}
                signal={signal}
                index={i}
                compact={compact}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
