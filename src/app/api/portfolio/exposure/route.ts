import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calculatePortfolioExposure } from "@/lib/risk-engine";
import type { RiskScore } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExposureRequestSchema = z.object({
  holdings: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      region_exposure: z.record(z.string(), z.number()),
      current_value_usd: z.number().positive(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ExposureRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message },
        { status: 400 }
      );
    }

    const { holdings } = parsed.data;

    // Fetch live risk scores from Supabase
    const supabase = await createClient();
    const { data: riskRows } = await supabase
      .from("risk_scores")
      .select("region, score")
      .order("calculated_at", { ascending: false });

    // Deduplicate: keep most recent per region
    const seen = new Set<string>();
    const latestScores: Pick<RiskScore, "region" | "score">[] = [];
    for (const row of (riskRows ?? []) as Pick<RiskScore, "region" | "score">[]) {
      if (!seen.has(row.region)) {
        seen.add(row.region);
        latestScores.push(row);
      }
    }

    // Build risk score lookup map (default 20 if no data)
    const riskScoreMap = new Map<string, number>(
      latestScores.map((rs) => [rs.region, rs.score])
    );

    // Calculate exposure for each holding
    const results = holdings.map((holding) => ({
      id: holding.id,
      name: holding.name,
      risk_score: calculatePortfolioExposure(
        holding.region_exposure,
        riskScoreMap
      ),
      value_at_risk: Math.round(
        holding.current_value_usd *
          (calculatePortfolioExposure(holding.region_exposure, riskScoreMap) /
            100) *
          0.15
      ),
      region_breakdown: Object.entries(holding.region_exposure).map(
        ([region, weight]) => ({
          region,
          weight,
          risk_score: riskScoreMap.get(region) ?? 20,
          contribution: (riskScoreMap.get(region) ?? 20) * (weight as number),
        })
      ),
    }));

    // Portfolio-level aggregate
    const totalValue = holdings.reduce(
      (sum, h) => sum + h.current_value_usd,
      0
    );
    const weightedRisk = results.reduce(
      (sum, r) =>
        sum +
        r.risk_score *
          (holdings.find((h) => h.id === r.id)?.current_value_usd ?? 0),
      0
    );
    const portfolioRiskScore =
      totalValue > 0 ? Math.round(weightedRisk / totalValue) : 0;

    return NextResponse.json({
      data: {
        holdings: results,
        portfolio: {
          total_value: totalValue,
          risk_score: portfolioRiskScore,
          total_var: results.reduce((sum, r) => sum + r.value_at_risk, 0),
        },
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] portfolio/exposure error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to calculate exposure" },
      { status: 500 }
    );
  }
}
