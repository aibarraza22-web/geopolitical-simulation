import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateFlashpointPrediction } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { RiskScore, Signal } from "@/types";

const RequestSchema = z.object({
  flashpoint: z.string().min(1),
  region_key: z.string().min(1),
});

// =============================================================================
// POST /api/predictions/generate
// Generates a fresh AXIOM prediction for a given flashpoint and saves it
// =============================================================================
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.message },
      { status: 400 }
    );
  }

  const { flashpoint, region_key } = parsed.data;

  try {
    const supabase = await createClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();

    // 1. Fetch risk score for this region (most recent)
    const { data: riskRows } = await supabase
      .from("risk_scores")
      .select("*")
      .ilike("region", flashpoint)
      .order("calculated_at", { ascending: false })
      .limit(1);

    const riskScore: RiskScore | null =
      riskRows && riskRows.length > 0 ? (riskRows[0] as RiskScore) : null;

    const riskData = riskScore
      ? {
          score: riskScore.score,
          trend: riskScore.trend,
          trend_delta: riskScore.trend_delta,
          signals_today: riskScore.signals_today,
          composite_breakdown: riskScore.composite_breakdown,
        }
      : null;

    // 2. Fetch live signals for this specific region from the last 7 days.
    // Query by region directly in DB — avoids pulling a global batch and filtering in JS.
    // This ensures predictions are grounded in the actual live signal data.
    const { data: signalRows } = await supabase
      .from("signals")
      .select("headline, source, severity, domain, published_at, summary, source_url, regions")
      .contains("regions", [flashpoint])
      .gte("published_at", sevenDaysAgo)
      .order("published_at", { ascending: false })
      .limit(30);

    let relevantSignals: Signal[] = (signalRows ?? []) as Signal[];

    // Fallback: if DB-level contains() returns nothing (e.g. region name partial mismatch),
    // pull a larger batch and filter in memory.
    if (relevantSignals.length === 0) {
      const { data: fallbackRows } = await supabase
        .from("signals")
        .select("headline, source, severity, domain, published_at, summary, source_url, regions")
        .gte("published_at", sevenDaysAgo)
        .order("published_at", { ascending: false })
        .limit(300);

      const allSignals: Signal[] = (fallbackRows ?? []) as Signal[];
      relevantSignals = allSignals.filter((s) =>
        (s.regions ?? []).some(
          (r) =>
            r.toLowerCase().includes(flashpoint.toLowerCase()) ||
            flashpoint.toLowerCase().includes(r.toLowerCase())
        )
      );
    }

    const recentSignals = relevantSignals.slice(0, 20).map((s) => ({
      headline: s.headline,
      source: s.source,
      severity: s.severity,
      domain: s.domain,
      published_at: s.published_at,
      summary: (s as Signal & { summary?: string }).summary ?? "",
    }));

    console.log(`[Predictions] ${flashpoint}: ${recentSignals.length} live signals found`);

    // 3. Fetch relevant research corpus documents
    const { data: corpusRows } = await supabase
      .from("research_corpus")
      .select("title, content")
      .order("published_at", { ascending: false })
      .limit(5);

    const historicalContext = ((corpusRows ?? []) as { title: string; content: string }[]).map(
      (r) => ({
        title: r.title,
        content: r.content,
      })
    );

    // 4. Call Claude with the live signal data
    const predictionData = await generateFlashpointPrediction(
      flashpoint,
      region_key,
      riskData,
      recentSignals,
      historicalContext
    );

    // 5. Upsert into predictions table (one per flashpoint)
    const now = new Date();
    const nextUpdate = new Date(now.getTime() + 15 * 60 * 1000); // +15 minutes

    const upsertPayload = {
      ...predictionData,
      escalation_paths: predictionData.escalation_paths,
      affected_assets: predictionData.affected_assets,
      key_indicators: predictionData.key_indicators,
      generated_at: now.toISOString(),
      next_update: nextUpdate.toISOString(),
    };

    const { data: saved, error: upsertError } = await supabase
      .from("predictions")
      .upsert(upsertPayload, { onConflict: "flashpoint" })
      .select()
      .single();

    if (upsertError) {
      console.error("[Predictions/Generate] Upsert error:", upsertError);
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ prediction: saved });
  } catch (error) {
    console.error("[Predictions/Generate] Error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
