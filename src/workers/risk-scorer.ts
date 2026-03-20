import { Worker, type Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { calculateRiskScore, determineTrend } from "@/lib/risk-engine";
import { cacheSet, CacheKeys } from "@/lib/redis";
import {
  QUEUE_NAMES,
  type RiskScorerJobData,
} from "./queue";
import type { Signal, RiskScore } from "@/types";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
  maxRetriesPerRequest: null as null,
};

// All monitored regions
const ALL_REGIONS = [
  "Taiwan Strait",
  "Ukraine-Russia",
  "Iran-Israel",
  "Middle East",
  "South China Sea",
  "Sahel Region",
  "Korean Peninsula",
  "Venezuela",
];

function getSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================================================
// Risk Scorer Worker
// =============================================================================
async function processJob(job: Job<RiskScorerJobData>): Promise<void> {
  const { regions, force } = job.data;
  const regionsToProcess = regions ?? ALL_REGIONS;

  console.log(
    `[RiskScorer] Processing ${regionsToProcess.length} regions (force=${force})`
  );

  const supabase = getSupabaseService();

  // Fetch signals from the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

  const { data: allSignals, error: signalError } = await supabase
    .from("signals")
    .select("*")
    .gte("published_at", sevenDaysAgo);

  if (signalError) {
    console.error("[RiskScorer] Error fetching signals:", signalError.message);
    return;
  }

  const signals: Signal[] = (allSignals ?? []) as Signal[];
  const updatedScores: RiskScore[] = [];

  for (const region of regionsToProcess) {
    try {
      // Filter signals for this region
      const regionSignals = signals.filter((s) =>
        s.regions.some(
          (r) =>
            r.toLowerCase().includes(region.toLowerCase()) ||
            region.toLowerCase().includes(r.toLowerCase())
        )
      );

      // Fetch previous score for momentum blending
      const { data: prevScoreRow } = await supabase
        .from("risk_scores")
        .select("score")
        .eq("region", region)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const previousScore = (prevScoreRow as { score?: number } | null)?.score ?? 50;

      // Fetch last 7 historical scores for trend calculation
      const { data: historicalRows } = await supabase
        .from("risk_scores")
        .select("score")
        .eq("region", region)
        .order("calculated_at", { ascending: false })
        .limit(7);

      const historicalScores = ((historicalRows ?? []) as { score: number }[]).map(
        (r) => r.score
      );

      const { score, composite_breakdown } = calculateRiskScore(
        region,
        regionSignals,
        previousScore
      );

      const { trend, delta } = determineTrend(score, historicalScores);

      const riskScore: RiskScore = {
        id: crypto.randomUUID(),
        region,
        country_codes: [],
        score,
        trend,
        trend_delta: delta,
        signals_today: regionSignals.filter(
          (s) => new Date(s.published_at) > new Date(Date.now() - 24 * 3600000)
        ).length,
        composite_breakdown,
        calculated_at: new Date().toISOString(),
        top_signals: regionSignals
          .sort((a, b) => {
            const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
            return order[a.severity] - order[b.severity];
          })
          .slice(0, 3),
      };

      updatedScores.push(riskScore);

      console.log(
        `[RiskScorer] ${region}: ${previousScore} → ${score} (${trend}, delta=${delta})`
      );
    } catch (err) {
      console.error(`[RiskScorer] Error processing ${region}:`, err);
    }
  }

  // Upsert to Supabase
  if (updatedScores.length > 0) {
    const { error: upsertError } = await supabase.from("risk_scores").upsert(
      updatedScores.map((rs) => ({ ...rs, embedding: null })),
      { onConflict: "region" }
    );

    if (upsertError) {
      console.error("[RiskScorer] Supabase upsert error:", upsertError.message);
    }
  }

  // Cache updated scores
  await cacheSet(CacheKeys.riskScores(), updatedScores, 900);
  for (const rs of updatedScores) {
    await cacheSet(CacheKeys.riskScore(rs.region), rs, 900);
  }

  console.log(
    `[RiskScorer] Updated and cached ${updatedScores.length} risk scores`
  );
}

// =============================================================================
// Worker instance
// =============================================================================
const worker = new Worker<RiskScorerJobData>(
  QUEUE_NAMES.RISK_SCORER,
  processJob,
  {
    connection,
    concurrency: 1,
  }
);

worker.on("completed", (job) => {
  console.log(`[RiskScorer] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[RiskScorer] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[RiskScorer] Worker error:", err);
});

console.log("[RiskScorer] Worker started");

process.on("SIGTERM", async () => {
  console.log("[RiskScorer] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
});

export default worker;
