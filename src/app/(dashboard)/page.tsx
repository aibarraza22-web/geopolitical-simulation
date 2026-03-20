import { Suspense } from "react";
import { DashboardClient } from "./_components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
import type { Signal, RiskScore, Scenario } from "@/types";

// Revalidate every 60 seconds
export const revalidate = 60;

async function fetchDashboardData() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [riskScoresRes, recentSignalsRes, signalsTodayRes, scenariosRes] =
    await Promise.allSettled([
      supabase
        .from("risk_scores")
        .select("*")
        .order("calculated_at", { ascending: false })
        .limit(100),
      supabase
        .from("signals")
        .select("*")
        .order("ingested_at", { ascending: false })
        .limit(20),
      supabase
        .from("signals")
        .select("id", { count: "exact", head: true })
        .gte("ingested_at", todayStart.toISOString()),
      supabase
        .from("scenarios")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  // Deduplicate risk scores — keep most recent per region
  const allScores =
    riskScoresRes.status === "fulfilled"
      ? ((riskScoresRes.value.data ?? []) as RiskScore[])
      : [];
  const seenRegions = new Set<string>();
  const riskScores: RiskScore[] = [];
  for (const rs of allScores) {
    if (!seenRegions.has(rs.region)) {
      seenRegions.add(rs.region);
      riskScores.push(rs);
    }
  }

  const recentSignals: Signal[] =
    recentSignalsRes.status === "fulfilled"
      ? ((recentSignalsRes.value.data ?? []) as Signal[])
      : [];

  const signalsToday: number =
    signalsTodayRes.status === "fulfilled"
      ? (signalsTodayRes.value.count ?? 0)
      : 0;

  const scenarios: Scenario[] =
    scenariosRes.status === "fulfilled"
      ? ((scenariosRes.value.data ?? []) as Scenario[])
      : [];

  return { riskScores, recentSignals, signalsToday, scenarios };
}

export default async function DashboardPage() {
  const data = await fetchDashboardData();
  return (
    <Suspense fallback={null}>
      <DashboardClient {...data} />
    </Suspense>
  );
}
