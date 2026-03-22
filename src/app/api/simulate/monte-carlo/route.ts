import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import { runMonteCarlo, STATE_LABELS, STATES } from "@/lib/monte-carlo";
import type { Signal, RiskScore } from "@/types";

const Schema = z.object({
  flashpoint: z.string().min(3).max(200),
  region_key: z.string().min(2).max(100),
  time_horizon: z.enum(["24h", "7d", "30d", "90d", "1y"]),
  actors: z.array(z.string()).default([]),
  sim_count: z.number().int().min(1000).max(50000).default(10000),
});

export interface AgentDecision {
  name: string;
  posture: string;
  decision: string;
  escalation_modifier: number; // -1 to 1
  rationale: string;
}

export interface MonteCarloResponse {
  result: ReturnType<typeof runMonteCarlo>;
  agentDecisions: AgentDecision[];
  aggregateModifier: number;
  riskScore: number;
  signalCount: number;
  flashpoint: string;
  time_horizon: string;
}

// =============================================================================
// POST /api/simulate/monte-carlo
// =============================================================================
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { flashpoint, region_key, time_horizon, actors, sim_count } = parsed.data;

  try {
    const supabase = await createClient();

    // 1. Fetch latest risk score for this region
    const { data: riskRows } = await supabase
      .from("risk_scores")
      .select("*")
      .ilike("region", `%${region_key.replace(/-/g, " ")}%`)
      .order("calculated_at", { ascending: false })
      .limit(1);

    const riskScore: number =
      riskRows && riskRows.length > 0
        ? (riskRows[0] as RiskScore).score
        : 50; // default to moderate risk

    // 2. Fetch recent signals for the region
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: signalRows } = await supabase
      .from("signals")
      .select("id, headline, severity, sentiment_score, regions, domain")
      .contains("regions", [flashpoint])
      .gte("published_at", sevenDaysAgo)
      .order("published_at", { ascending: false })
      .limit(50);

    const signals = (signalRows ?? []) as Pick<
      Signal,
      "id" | "headline" | "severity" | "sentiment_score" | "regions" | "domain"
    >[];

    // 3. Multi-agent layer: ask Claude to generate agent decisions
    const actorList =
      actors.length > 0
        ? actors
        : inferDefaultActors(flashpoint);

    const agentDecisions: AgentDecision[] = [];
    let aggregateModifier = 0;

    if (actorList.length > 0) {
      const recentHeadlines = signals
        .slice(0, 10)
        .map((s) => `- [${s.severity}] ${s.headline}`)
        .join("\n");

      const agentPrompt = `You are AXIOM, an advanced geopolitical AI. Analyze the following scenario and generate realistic agent decisions.

FLASHPOINT: ${flashpoint}
CURRENT RISK SCORE: ${riskScore}/100
TIME HORIZON: ${time_horizon}
RECENT SIGNALS (last 7 days):
${recentHeadlines || "No recent signals available"}

For each of the following actors, generate their most likely decision/posture in this scenario:
ACTORS: ${actorList.join(", ")}

Return ONLY valid JSON in this exact format:
{
  "agents": [
    {
      "name": "actor name",
      "posture": "one of: aggressive, deterrent, diplomatic, defensive, opportunistic, neutral",
      "decision": "specific action this actor is most likely to take (1-2 sentences)",
      "escalation_modifier": 0.15,
      "rationale": "brief explanation (1 sentence)"
    }
  ]
}

escalation_modifier rules:
- Range: -0.5 (strongly de-escalatory) to +0.5 (strongly escalatory)
- 0 = neutral/status quo
- Sum should reflect net escalation pressure from all actors combined
- Be realistic based on current signals and historical behavior`;

      try {
        const anthropic = getAnthropicClient();
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          messages: [{ role: "user", content: agentPrompt }],
        });

        const text =
          response.content[0].type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            agents: AgentDecision[];
          };
          agentDecisions.push(...(parsed.agents ?? []));
          aggregateModifier =
            agentDecisions.reduce((sum, a) => sum + a.escalation_modifier, 0) /
            Math.max(1, agentDecisions.length);
        }
      } catch (e) {
        console.error("[MonteCarlo] Agent decision error:", e);
        // Continue without agent modifiers
      }
    }

    // 4. Run Monte Carlo simulation
    const result = runMonteCarlo(
      riskScore,
      signals,
      time_horizon,
      sim_count,
      aggregateModifier
    );

    const response: MonteCarloResponse = {
      result,
      agentDecisions,
      aggregateModifier,
      riskScore,
      signalCount: signals.length,
      flashpoint,
      time_horizon,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[MonteCarlo] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Simulation failed" },
      { status: 500 }
    );
  }
}

function inferDefaultActors(flashpoint: string): string[] {
  const f = flashpoint.toLowerCase();
  if (f.includes("taiwan")) return ["China (PLA)", "USA (Pentagon)", "Taiwan (ROC)"];
  if (f.includes("iran") || f.includes("israel")) return ["Iran (IRGC)", "Israel (IDF)", "USA", "Hezbollah"];
  if (f.includes("ukraine") || f.includes("russia")) return ["Russia", "Ukraine", "NATO", "EU"];
  if (f.includes("korea")) return ["North Korea", "South Korea", "USA", "China"];
  if (f.includes("china") || f.includes("south china sea")) return ["China", "USA", "ASEAN Nations", "Japan"];
  if (f.includes("india") || f.includes("pakistan")) return ["India", "Pakistan", "China"];
  return ["State Actor A", "State Actor B", "USA", "UN Security Council"];
}

// Export state info for use in the UI
export { STATES, STATE_LABELS };
