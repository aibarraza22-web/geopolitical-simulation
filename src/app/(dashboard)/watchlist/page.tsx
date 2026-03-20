"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Bell, BellOff, Trash2, Globe, User, Hash, MapPin, Eye } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignalFeed } from "@/components/feed/SignalFeed";
import { createClient } from "@/lib/supabase/client";
import { getRiskColor, formatRelativeTime } from "@/lib/utils";
import type { WatchlistItem, AlertRule, Signal, RiskScore } from "@/types";

const typeIcon = {
  region: Globe,
  country: MapPin,
  signal_topic: Hash,
  entity: User,
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [riskScores, setRiskScores] = useState<RiskScore[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({ type: "region", value: "", label: "" });

  useEffect(() => {
    const supabase = createClient();

    const loadAll = async () => {
      const [watchlistRes, alertsRes, riskRes, signalsRes] = await Promise.allSettled([
        supabase
          .from("watchlists")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("alert_rules")
          .select("*")
          .order("created_at", { ascending: false }),
        fetch("/api/risk-scores").then((r) => r.json()) as Promise<{ data?: RiskScore[] }>,
        supabase
          .from("signals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (watchlistRes.status === "fulfilled") {
        setWatchlist((watchlistRes.value.data ?? []) as WatchlistItem[]);
      }
      if (alertsRes.status === "fulfilled") {
        setAlerts((alertsRes.value.data ?? []) as AlertRule[]);
      }
      if (riskRes.status === "fulfilled") {
        setRiskScores((riskRes.value as { data?: RiskScore[] }).data ?? []);
      }
      if (signalsRes.status === "fulfilled") {
        setSignals((signalsRes.value.data ?? []) as Signal[]);
      }

      setLoading(false);
    };

    void loadAll();
  }, []);

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("watchlists").delete().eq("id", id);
    if (!error) {
      setWatchlist((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleToggleAlert = async (id: string) => {
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("alert_rules")
      .update({ is_active: !alert.is_active })
      .eq("id", id);
    if (!error) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a))
      );
    }
  };

  const handleAddItem = async () => {
    if (!newItem.value) return;
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? "anonymous";

    const item = {
      id: crypto.randomUUID(),
      org_id: userId,
      user_id: userId,
      type: newItem.type as WatchlistItem["type"],
      value: newItem.value,
      label: newItem.label || newItem.value,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("watchlists").insert([item]);
    if (!error) {
      setWatchlist((prev) => [item, ...prev]);
    }
    setShowAddModal(false);
    setNewItem({ type: "region", value: "", label: "" });
  };

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
            WATCHLIST
          </h1>
          <p className="text-xs text-white/40 mt-0.5 font-mono">
            Monitor regions, entities, and topics of interest
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={() => setShowAddModal(true)}
        >
          Add Item
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Watchlist + Alerts */}
        <div className="space-y-4">
          {/* Watchlist items */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <CardTitle>Watching ({watchlist.length})</CardTitle>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {loading ? (
                <div className="px-4 py-8 text-center text-white/30 text-xs font-mono animate-pulse">
                  Loading...
                </div>
              ) : watchlist.length === 0 ? (
                <EmptyState
                  icon={<Eye size={16} />}
                  title="Nothing watched"
                  description="Add regions or topics to your watchlist."
                />
              ) : (
                <AnimatePresence>
                  {watchlist.map((item) => {
                    const Icon = typeIcon[item.type] ?? Globe;
                    const riskScore = riskScores.find(
                      (rs) => rs.region === item.value
                    );
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 px-4 py-3 group"
                      >
                        <div className="w-7 h-7 rounded-sm bg-axiom-cyan/10 border border-axiom-cyan/20 flex items-center justify-center shrink-0">
                          <Icon size={12} className="text-axiom-cyan" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/80">
                            {item.label}
                          </p>
                          <p className="text-[10px] text-white/35 capitalize">
                            {item.type.replace("_", " ")} ·{" "}
                            {formatRelativeTime(item.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {riskScore && (
                            <span
                              className="text-sm font-mono font-bold"
                              style={{ color: getRiskColor(riskScore.score) }}
                            >
                              {riskScore.score}
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-white/20 hover:text-axiom-red transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </Card>

          {/* Alert rules */}
          <Card padding="none">
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <CardTitle>Alert Rules</CardTitle>
              <span className="text-[10px] font-mono text-axiom-amber">
                {alerts.filter((a) => a.is_active).length} active
              </span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {alerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-white/25 text-[11px] font-mono">
                  No alert rules configured
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-white/80">
                          {alert.name}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {alert.condition.replace("_", " ")} {alert.threshold} ·{" "}
                          {alert.target}
                        </p>
                      </div>
                      <button
                        onClick={() => handleToggleAlert(alert.id)}
                        className={`p-1.5 rounded-sm transition-colors ${
                          alert.is_active
                            ? "text-axiom-green hover:text-axiom-green/70"
                            : "text-white/25 hover:text-white/50"
                        }`}
                      >
                        {alert.is_active ? (
                          <Bell size={13} />
                        ) : (
                          <BellOff size={13} />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.channels.map((ch) => (
                        <span
                          key={ch}
                          className="text-[9px] font-mono text-white/30 bg-white/[0.04] px-1.5 py-0.5 rounded-[2px] uppercase"
                        >
                          {ch}
                        </span>
                      ))}
                      {alert.last_triggered_at && (
                        <span className="text-[10px] font-mono text-axiom-amber/60">
                          Last: {formatRelativeTime(alert.last_triggered_at)}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right: Signal feed */}
        <div className="lg:col-span-2">
          <Card padding="none" className="h-full" style={{ minHeight: 500 }}>
            <SignalFeed
              signals={signals}
              title="Watchlist Signal Feed"
              maxItems={20}
              showFilters={true}
            />
          </Card>
        </div>
      </div>

      {/* Add item modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Watchlist Item"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="axiom-label">Type</label>
            <select
              className="axiom-select"
              value={newItem.type}
              onChange={(e) => setNewItem((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="region">Region</option>
              <option value="country">Country</option>
              <option value="entity">Entity / Company</option>
              <option value="signal_topic">Signal Topic</option>
            </select>
          </div>
          <div>
            <label className="axiom-label">Value</label>
            <input
              className="axiom-input"
              placeholder={
                newItem.type === "region"
                  ? "e.g. Taiwan Strait"
                  : newItem.type === "entity"
                  ? "e.g. TSMC"
                  : "Enter value..."
              }
              value={newItem.value}
              onChange={(e) =>
                setNewItem((p) => ({ ...p, value: e.target.value }))
              }
            />
          </div>
          <div>
            <label className="axiom-label">Display Label (optional)</label>
            <input
              className="axiom-input"
              placeholder="Leave blank to use value"
              value={newItem.label}
              onChange={(e) =>
                setNewItem((p) => ({ ...p, label: e.target.value }))
              }
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleAddItem}
              disabled={!newItem.value}
            >
              Add to Watchlist
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
