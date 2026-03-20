"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Plus, Briefcase, Search, Loader2, X,
} from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExposureBar } from "@/components/charts/ExposureBar";
import { getRiskColor, formatCurrency, cn } from "@/lib/utils";
import type { PortfolioHolding } from "@/types";

const DOMAIN_KEYS = [
  "military", "financial", "political", "humanitarian", "trade", "energy",
] as const;

// Compute expected return impact based on risk score and domain breakdown.
// Returns { range: "-8% to -18%", direction: "down", driver: "Military" }
function computeProjection(holding: PortfolioHolding): {
  range: string;
  direction: "down" | "neutral" | "mixed";
  driver: string;
  dollarImpact: [number, number]; // [low, high] dollar impact
} {
  const r = holding.risk_score;
  const b = holding.exposure_breakdown;
  const v = holding.current_value_usd;

  // Find dominant domain
  const domainEntries = Object.entries(b) as [string, number][];
  const topDomain = domainEntries.sort((a, b2) => b2[1] - a[1])[0];
  const driver = topDomain ? topDomain[0].charAt(0).toUpperCase() + topDomain[0].slice(1) : "Geopolitical";

  if (r === 0) {
    return { range: "Minimal", direction: "neutral", driver: "None", dollarImpact: [0, 0] };
  }
  if (r <= 30) {
    const lo = Math.round(v * 0.01);
    const hi = Math.round(v * 0.03);
    return { range: "-1% to -3%", direction: "neutral", driver, dollarImpact: [lo, hi] };
  }
  if (r <= 60) {
    const lo = Math.round(v * 0.03);
    const hi = Math.round(v * 0.10);
    return { range: "-3% to -10%", direction: "mixed", driver, dollarImpact: [lo, hi] };
  }
  if (r <= 80) {
    const lo = Math.round(v * 0.10);
    const hi = Math.round(v * 0.20);
    return { range: "-10% to -20%", direction: "down", driver, dollarImpact: [lo, hi] };
  }
  const lo = Math.round(v * 0.20);
  const hi = Math.round(v * 0.35);
  return { range: "-20% to -35%", direction: "down", driver, dollarImpact: [lo, hi] };
}

interface TickerResult {
  ticker: string;
  name: string;
  exchange: string;
  type: string;
}

interface ResolvedTicker {
  name: string;
  ticker: string;
  country: string;
  sector: string;
  region: string | null;
  risk_score: number;
  exposure_breakdown: Record<string, number>;
  region_exposure: Record<string, number>;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debouncedValue;
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ticker search state
  const [tickerQuery, setTickerQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TickerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedTicker | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Form state (only what the user controls)
  const [assetClass, setAssetClass] = useState("Equity");
  const [valueUsd, setValueUsd] = useState("");

  const debouncedQuery = useDebounce(tickerQuery, 300);

  useEffect(() => {
    fetch("/api/portfolio/holdings")
      .then((r) => r.json())
      .then((json: { data?: PortfolioHolding[] }) => setHoldings(json.data ?? []))
      .catch(() => setHoldings([]))
      .finally(() => setLoading(false));
  }, []);

  // Ticker search
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1 || resolved) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setSearchLoading(true);
    fetch(`/api/portfolio/ticker-search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((r) => r.json())
      .then((json: { data: TickerResult[] }) => {
        setSearchResults(json.data ?? []);
        setShowDropdown((json.data ?? []).length > 0);
      })
      .catch(() => setSearchResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedQuery, resolved]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectTicker = useCallback(async (result: TickerResult) => {
    setShowDropdown(false);
    setTickerQuery(`${result.ticker} — ${result.name}`);
    setResolving(true);
    try {
      const res = await fetch(`/api/portfolio/ticker-resolve?ticker=${encodeURIComponent(result.ticker)}`);
      const json = await res.json() as { data?: ResolvedTicker };
      if (json.data) {
        setResolved(json.data);
        if (!assetClass || assetClass === "Equity") {
          // keep existing asset class
        }
      }
    } catch {
      // resolve failed — still use basic info
      setResolved({
        name: result.name,
        ticker: result.ticker,
        country: "",
        sector: "",
        region: null,
        risk_score: 0,
        exposure_breakdown: { military: 0, financial: 0, political: 0, humanitarian: 0, trade: 0, energy: 0 },
        region_exposure: {},
      });
    } finally {
      setResolving(false);
    }
  }, [assetClass]);

  const clearSelection = () => {
    setResolved(null);
    setTickerQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const resetModal = () => {
    clearSelection();
    setAssetClass("Equity");
    setValueUsd("");
    setFormError(null);
  };

  const handleAdd = async () => {
    if (!resolved) { setFormError("Search for and select a ticker first"); return; }
    const value = parseFloat(valueUsd);
    if (!value || value <= 0) { setFormError("Enter a valid position value"); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const varEstimate = Math.round(value * (resolved.risk_score / 100) * 0.12);
      const res = await fetch("/api/portfolio/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resolved.name,
          ticker: resolved.ticker,
          asset_class: assetClass,
          current_value_usd: value,
          risk_score: resolved.risk_score,
          var_95: varEstimate,
          region_exposure: resolved.region_exposure,
          exposure_breakdown: resolved.exposure_breakdown,
        }),
      });
      const json = (await res.json()) as { data?: PortfolioHolding; error?: string };
      if (!res.ok || json.error) {
        setFormError(json.error ?? "Failed to add holding");
        return;
      }
      if (json.data) setHoldings((prev) => [json.data!, ...prev]);
      setShowAddModal(false);
      resetModal();
    } catch {
      setFormError("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this holding?")) return;
    const res = await fetch(`/api/portfolio/holdings?id=${id}`, { method: "DELETE" });
    if (res.ok) setHoldings((prev) => prev.filter((h) => h.id !== id));
  };

  const totalValue = holdings.reduce((sum, h) => sum + h.current_value_usd, 0);
  const totalVar = holdings.reduce((sum, h) => sum + h.var_95, 0);
  const avgRisk = holdings.length > 0
    ? holdings.reduce((sum, h) => sum + h.risk_score, 0) / holdings.length
    : 0;
  const highRiskCount = holdings.filter((h) => h.risk_score >= 70).length;

  const riskColor = resolved
    ? resolved.risk_score === 0
      ? "#6b7280"
      : getRiskColor(resolved.risk_score)
    : "#6b7280";

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
            PORTFOLIO EXPOSURE
          </h1>
          <p className="text-xs text-white/40 mt-0.5 font-mono">
            Geopolitical risk exposure analysis across holdings
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => setShowAddModal(true)}
        >
          Add Holding
        </Button>
      </motion.div>

      {/* KPI row */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: "Total Portfolio Value", value: loading ? "—" : formatCurrency(totalValue), icon: DollarSign, color: "#00d4ff" },
          { label: "Portfolio Risk Score", value: loading ? "—" : avgRisk.toFixed(1), icon: AlertTriangle, color: getRiskColor(avgRisk) },
          { label: "VaR 95% (1-day)", value: loading ? "—" : formatCurrency(totalVar), icon: TrendingDown, color: "#ff3b3b" },
          { label: "High-Risk Holdings", value: loading ? "—" : String(highRiskCount), icon: TrendingUp, color: "#f0a500" },
        ].map((kpi) => (
          <Card key={kpi.label} accentColor={kpi.color}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={13} style={{ color: kpi.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 font-ui">
                {kpi.label}
              </span>
            </div>
            <p className="font-display text-3xl tracking-wider" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
          </Card>
        ))}
      </motion.div>

      {/* Holdings */}
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="text-xs font-mono text-white/30 animate-pulse">Loading holdings...</div>
        </div>
      ) : holdings.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={20} />}
          title="No holdings yet"
          description="Add your first holding to start tracking geopolitical exposure across your portfolio."
          action={
            <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
              Add First Holding
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Holdings table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-2"
          >
            <Card padding="none">
              <div className="px-4 py-3 border-b border-white/[0.07]">
                <CardTitle>Holdings — Risk Exposure</CardTitle>
              </div>
              <div className="overflow-x-auto">
                <table className="axiom-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Value</th>
                      <th>Risk Score</th>
                      <th>Projected Impact</th>
                      <th>VaR 95%</th>
                      <th>Region</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((holding, i) => {
                      const color = getRiskColor(holding.risk_score);
                      const proj = computeProjection(holding);
                      const projColor = proj.direction === "down" ? "#ff3b3b" : proj.direction === "mixed" ? "#f0a500" : "#6b7280";
                      return (
                        <motion.tr
                          key={holding.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 + i * 0.05 }}
                        >
                          <td>
                            <div>
                              <p className="text-sm font-semibold text-white/85">{holding.name}</p>
                              {holding.ticker && (
                                <p className="text-[10px] font-mono text-axiom-cyan/60">{holding.ticker}</p>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="text-sm font-mono text-white/80">
                              {formatCurrency(holding.current_value_usd)}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${holding.risk_score}%`, backgroundColor: color, opacity: 0.85 }}
                                />
                              </div>
                              <span className="text-sm font-mono font-bold" style={{ color }}>
                                {holding.risk_score}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div>
                              <div className="flex items-center gap-1">
                                {proj.direction === "down" ? (
                                  <TrendingDown size={11} style={{ color: projColor }} />
                                ) : proj.direction === "mixed" ? (
                                  <AlertTriangle size={11} style={{ color: projColor }} />
                                ) : (
                                  <TrendingUp size={11} className="text-white/30" />
                                )}
                                <span className="text-xs font-mono font-bold" style={{ color: projColor }}>
                                  {proj.range}
                                </span>
                              </div>
                              <p className="text-[9px] font-mono text-white/30 mt-0.5">
                                {proj.driver} · up to {formatCurrency(proj.dollarImpact[1])} at risk
                              </p>
                            </div>
                          </td>
                          <td>
                            <span className="text-sm font-mono text-axiom-red/80">
                              {formatCurrency(holding.var_95)}
                            </span>
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {Object.entries(holding.region_exposure)
                                .filter(([, w]) => (w as number) > 0.05)
                                .map(([region, weight]) => (
                                  <span
                                    key={region}
                                    className="text-[9px] font-mono text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded-[2px]"
                                  >
                                    {region.split(" ")[0]} {Math.round((weight as number) * 100)}%
                                  </span>
                                ))}
                              {Object.keys(holding.region_exposure).length === 0 && (
                                <span className="text-[9px] font-mono text-white/20">—</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <button
                              onClick={() => handleDelete(holding.id)}
                              className="text-[10px] text-white/25 hover:text-axiom-red transition-colors"
                            >
                              Remove
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>

          {/* Right panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Risk by Domain</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {DOMAIN_KEYS.map((domain) => {
                  const avg = holdings.length > 0
                    ? holdings.reduce((sum, h) => sum + (h.exposure_breakdown[domain] ?? 0), 0) / holdings.length
                    : 0;
                  return (
                    <ExposureBar
                      key={domain}
                      label={domain.charAt(0).toUpperCase() + domain.slice(1)}
                      score={Math.round(avg)}
                      animate={true}
                      height={5}
                    />
                  );
                })}
              </div>
            </Card>

            {/* Portfolio-level projection */}
            {holdings.length > 0 && (() => {
              const totalV = holdings.reduce((s, h) => s + h.current_value_usd, 0);
              const totalLo = holdings.reduce((s, h) => s + computeProjection(h).dollarImpact[0], 0);
              const totalHi = holdings.reduce((s, h) => s + computeProjection(h).dollarImpact[1], 0);
              const worstHolding = [...holdings].sort((a, b) => b.risk_score - a.risk_score)[0];
              const portfolioImpactPct = totalV > 0 ? ((totalHi / totalV) * 100).toFixed(1) : "0";
              return (
                <Card accentColor="#ff3b3b">
                  <CardHeader>
                    <CardTitle>Portfolio Projection</CardTitle>
                  </CardHeader>
                  <p className="text-[10px] font-mono text-white/40 mb-3">
                    Geopolitical stress scenario · current risk levels
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-white/50">Downside exposure</span>
                      <span className="text-sm font-mono font-bold text-axiom-red">
                        -{formatCurrency(totalLo)} to -{formatCurrency(totalHi)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] text-white/50">Portfolio impact</span>
                      <span className="text-sm font-mono font-bold text-axiom-red">
                        up to -{portfolioImpactPct}%
                      </span>
                    </div>
                    {worstHolding && worstHolding.risk_score > 0 && (
                      <div className="flex justify-between items-baseline pt-1 border-t border-white/[0.05]">
                        <span className="text-[11px] text-white/50">Highest risk</span>
                        <span className="text-[11px] font-mono text-white/70">
                          {worstHolding.ticker ?? worstHolding.name.split(" ")[0]} ({worstHolding.risk_score})
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] font-mono text-white/25 mt-3">
                    Based on live geopolitical risk scores. Not financial advice.
                  </p>
                </Card>
              );
            })()}

            {holdings.filter((h) => h.risk_score >= 70).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Concentration Risk</CardTitle>
                </CardHeader>
                <div className="space-y-2.5">
                  {holdings
                    .filter((h) => h.risk_score >= 70)
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((h) => (
                      <div key={h.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/75 truncate">
                            {h.ticker ?? h.name.split(" ")[0]}
                          </p>
                          <p className="text-[10px] text-white/35">{formatCurrency(h.current_value_usd)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <AlertTriangle size={10} style={{ color: getRiskColor(h.risk_score) }} />
                          <span className="text-sm font-mono font-bold" style={{ color: getRiskColor(h.risk_score) }}>
                            {h.risk_score}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      )}

      {/* Add Holding Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); resetModal(); }}
        title="Add Holding"
        size="sm"
      >
        <div className="space-y-4">
          {formError && (
            <p className="text-xs text-axiom-red bg-axiom-red/10 border border-axiom-red/20 rounded-sm px-3 py-2">
              {formError}
            </p>
          )}

          {/* Ticker search */}
          <div>
            <label className="axiom-label">Search Ticker or Company *</label>
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                  className="axiom-input pl-8 pr-8"
                  placeholder="e.g. TSM, Apple, Samsung..."
                  value={tickerQuery}
                  onChange={(e) => {
                    if (resolved) clearSelection();
                    setTickerQuery(e.target.value);
                  }}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  autoComplete="off"
                />
                {(searchLoading || resolving) && (
                  <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 animate-spin" />
                )}
                {resolved && !resolving && (
                  <button
                    onClick={clearSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111214] border border-white/[0.1] rounded-sm shadow-xl overflow-hidden">
                  {searchResults.map((result) => (
                    <button
                      key={result.ticker}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] text-left transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault(); // prevent input blur
                        selectTicker(result);
                      }}
                    >
                      <div>
                        <span className="text-xs font-mono font-bold text-axiom-cyan">{result.ticker}</span>
                        <span className="text-xs text-white/60 ml-2 truncate max-w-[200px]">{result.name}</span>
                      </div>
                      <span className="text-[10px] text-white/25 font-mono shrink-0 ml-2">{result.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resolved ticker info */}
          {resolved && (
            <div className="rounded-sm border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80">{resolved.name}</p>
                  <p className="text-[10px] font-mono text-white/35">
                    {resolved.ticker}
                    {resolved.country ? ` · ${resolved.country}` : ""}
                    {resolved.sector ? ` · ${resolved.sector}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/35 uppercase tracking-widest">Geo Risk</p>
                  <p
                    className={cn("text-xl font-mono font-bold", resolved.risk_score === 0 && "text-white/30")}
                    style={resolved.risk_score > 0 ? { color: riskColor } : {}}
                  >
                    {resolving ? "—" : resolved.risk_score > 0 ? resolved.risk_score : "N/A"}
                  </p>
                </div>
              </div>
              {resolved.region && (
                <p className="text-[10px] font-mono text-white/40">
                  Region: <span className="text-white/60">{resolved.region}</span>
                </p>
              )}
              {!resolved.region && !resolving && (
                <p className="text-[10px] text-white/30 font-mono">
                  No elevated geopolitical risk region detected — risk score set to 0
                </p>
              )}
            </div>
          )}

          {/* Asset class */}
          <div>
            <label className="axiom-label">Asset Class *</label>
            <select
              className="axiom-select"
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value)}
            >
              <option>Equity</option>
              <option>Fixed Income</option>
              <option>Commodity</option>
              <option>FX / Currency</option>
              <option>Crypto</option>
              <option>Real Estate</option>
              <option>Alternative</option>
            </select>
          </div>

          {/* Position value */}
          <div>
            <label className="axiom-label">Position Value (USD) *</label>
            <input
              className="axiom-input"
              type="number"
              min={1}
              placeholder="e.g. 500000"
              value={valueUsd}
              onChange={(e) => setValueUsd(e.target.value)}
            />
            {resolved && valueUsd && parseFloat(valueUsd) > 0 && (
              <p className="text-[10px] text-white/35 font-mono mt-1">
                Estimated VaR 95%: {formatCurrency(Math.round(parseFloat(valueUsd) * (resolved.risk_score / 100) * 0.12))}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => { setShowAddModal(false); resetModal(); }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleAdd}
              loading={submitting}
              disabled={!resolved || !valueUsd || resolving}
            >
              Add Holding
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
