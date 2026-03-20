"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Activity, Database, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/utils";

interface AdminStats {
  user_count: number;
  signal_count: number;
  scenario_count: number;
  last_ingest_at: string | null;
}

const roleColors: Record<string, string> = {
  owner: "#f0a500",
  admin: "#00d4ff",
  analyst: "#00e676",
  viewer: "#6b7280",
};

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((json: { data?: AdminStats }) => {
        setStats(json.data ?? null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const handleBootstrap = async () => {
    setBootstrapping(true);
    setBootstrapResult(null);
    try {
      const res = await fetch("/api/bootstrap", { method: "POST" });
      const json = (await res.json()) as { message?: string; error?: string };
      if (json.error) {
        setBootstrapResult(`Error: ${json.error}`);
      } else {
        setBootstrapResult(json.message ?? "Bootstrap complete.");
        // Refresh stats
        const statsRes = await fetch("/api/admin/stats");
        const statsJson = (await statsRes.json()) as { data?: AdminStats };
        setStats(statsJson.data ?? null);
      }
    } catch {
      setBootstrapResult("Network error during bootstrap.");
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="font-display text-3xl tracking-widest text-white">
          ADMINISTRATION
        </h1>
        <p className="text-xs text-white/40 mt-0.5 font-mono">
          Organization settings, usage analytics, and system management
        </p>
      </motion.div>

      {/* Usage KPIs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Total Signals",
            value: loading ? "—" : String(stats?.signal_count ?? 0),
            color: "#00d4ff",
            icon: Activity,
          },
          {
            label: "Simulations Run",
            value: loading ? "—" : String(stats?.scenario_count ?? 0),
            color: "#f0a500",
            icon: Zap,
          },
          {
            label: "Users",
            value: loading ? "—" : String(stats?.user_count ?? 0),
            color: "#00e676",
            icon: Users,
          },
          {
            label: "Last Ingest",
            value: loading
              ? "—"
              : stats?.last_ingest_at
              ? formatRelativeTime(stats.last_ingest_at)
              : "Never",
            color: "#a855f7",
            icon: Database,
          },
        ].map((kpi) => (
          <Card key={kpi.label} accentColor={kpi.color}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={13} style={{ color: kpi.color }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40 font-ui">
                {kpi.label}
              </span>
            </div>
            <p
              className="font-display text-2xl tracking-wider"
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </p>
          </Card>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* System actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Bootstrap */}
          <Card>
            <CardHeader>
              <CardTitle>Data Bootstrap</CardTitle>
            </CardHeader>
            <p className="text-xs text-white/50 mb-3">
              Run a full data bootstrap: fetches signals from GDELT and RSS feeds,
              enriches them through Claude NLP, then scores all 8 monitored regions.
              Safe to run multiple times — duplicate signals are automatically skipped.
            </p>
            {bootstrapResult && (
              <p
                className={`text-xs font-mono mb-3 px-3 py-2 rounded-sm border ${
                  bootstrapResult.startsWith("Error")
                    ? "text-axiom-red bg-axiom-red/10 border-axiom-red/20"
                    : "text-axiom-green bg-axiom-green/10 border-axiom-green/20"
                }`}
              >
                {bootstrapResult}
              </p>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleBootstrap}
              loading={bootstrapping}
            >
              {bootstrapping ? "Bootstrapping..." : "Run Bootstrap"}
            </Button>
          </Card>

          {/* System status */}
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              {[
                { name: "Supabase DB", key: "db" },
                { name: "Signal Ingester", key: "ingest" },
                { name: "Risk Scorer", key: "scorer" },
                { name: "AI Pipeline (Claude)", key: "ai" },
              ].map((svc) => (
                <div key={svc.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        stats !== null ? "bg-axiom-green animate-pulse" : "bg-white/20"
                      }`}
                    />
                    <span className="text-[11px] text-white/65">{svc.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/35">
                    {loading ? "—" : stats !== null ? "ONLINE" : "UNKNOWN"}
                  </span>
                </div>
              ))}
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
          {/* Data summary */}
          <Card>
            <CardHeader>
              <CardTitle>Data Summary</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {[
                { label: "Total Signals", value: loading ? "—" : String(stats?.signal_count ?? 0) },
                { label: "Scenarios Run", value: loading ? "—" : String(stats?.scenario_count ?? 0) },
                {
                  label: "Last Signal Ingested",
                  value: loading
                    ? "—"
                    : stats?.last_ingest_at
                    ? formatRelativeTime(stats.last_ingest_at)
                    : "No data yet",
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-white/50">{item.label}</span>
                  <span className="text-sm font-mono text-axiom-cyan">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Bootstrap helper */}
          {!loading && (stats?.signal_count ?? 0) === 0 && (
            <Card accentColor="#f0a500">
              <CardHeader>
                <CardTitle>No Data Yet</CardTitle>
              </CardHeader>
              <p className="text-xs text-white/50 mb-3">
                The database is empty. Run a bootstrap to populate the system with real signals and risk scores.
              </p>
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={handleBootstrap}
                loading={bootstrapping}
              >
                Bootstrap Now
              </Button>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
