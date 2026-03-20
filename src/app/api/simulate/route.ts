import { NextRequest } from "next/server";
import { z } from "zod";
import { getAnthropicClient, buildSimulationPrompt, HISTORICAL_ANALOGUES } from "@/lib/anthropic";
import { createClient } from "@/lib/supabase/server";
import type { Signal, RiskScore, SimulationOutput } from "@/types";

const SimulationConfigSchema = z.object({
  trigger_event: z.string().min(10).max(2000),
  domain: z.enum(["Military", "Financial", "Political", "Humanitarian", "Trade", "Energy"]),
  time_horizon: z.enum(["24h", "7d", "30d", "90d", "1y"]),
  actors: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
});

// =============================================================================
// POST /api/simulate
// Streams scenario analysis via Server-Sent Events
// =============================================================================
export async function POST(request: NextRequest) {
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: "Invalid JSON body" })}\n\ndata: [DONE]\n\n`,
      { status: 400, headers }
    );
  }

  const parsed = SimulationConfigSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: parsed.error.message })}\n\ndata: [DONE]\n\n`,
      { status: 400, headers }
    );
  }

  const config = parsed.data;

  // Build keyword terms from trigger_event + regions for Supabase filtering
  const regionKeywords = config.regions.length > 0
    ? config.regions
    : ["Taiwan Strait", "Ukraine-Russia", "Iran-Israel", "Middle East", "South China Sea"];

  try {
    const supabase = await createClient();

    // Query recent signals relevant to the scenario
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600000).toISOString();

    // Fetch signals from the relevant regions
    const { data: signalRows } = await supabase
      .from("signals")
      .select("*")
      .gte("published_at", fortyEightHoursAgo)
      .order("published_at", { ascending: false })
      .limit(50);

    const allSignals: Signal[] = (signalRows ?? []) as Signal[];

    // Filter to relevant signals
    const relevantSignals = allSignals
      .filter((s) => {
        const domainMatch = s.domain === config.domain;
        const regionMatch =
          regionKeywords.length === 0 ||
          s.regions.some((r) =>
            regionKeywords.some((rk) =>
              r.toLowerCase().includes(rk.toLowerCase()) ||
              rk.toLowerCase().includes(r.toLowerCase())
            )
          );
        return domainMatch || regionMatch;
      })
      .slice(0, 10);

    // Query risk scores for relevant regions
    const { data: riskRows } = await supabase
      .from("risk_scores")
      .select("*")
      .order("calculated_at", { ascending: false })
      .limit(100);

    // Deduplicate risk scores: keep latest per region
    const seenRegions = new Set<string>();
    const latestRiskScores: RiskScore[] = [];
    for (const row of (riskRows ?? []) as RiskScore[]) {
      if (!seenRegions.has(row.region)) {
        seenRegions.add(row.region);
        latestRiskScores.push(row);
      }
    }

    const relevantRiskScores = config.regions.length > 0
      ? latestRiskScores.filter((rs) =>
          config.regions.some(
            (r) =>
              rs.region.toLowerCase().includes(r.toLowerCase()) ||
              r.toLowerCase().includes(rs.region.toLowerCase())
          )
        )
      : latestRiskScores.slice(0, 5);

    const prompt = buildSimulationPrompt(
      config,
      relevantRiskScores,
      relevantSignals,
      HISTORICAL_ANALOGUES.slice(0, 3)
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const anthropic = getAnthropicClient();

          const claudeStream = anthropic.messages.stream({
            model: "claude-sonnet-4-5",
            max_tokens: 4096,
            messages: [{ role: "user", content: prompt }],
          });

          let fullText = "";

          for await (const chunk of claudeStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const delta = chunk.delta.text;
              fullText += delta;
              sendEvent({ type: "delta", content: delta });
            }
          }

          let output: SimulationOutput;
          try {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in response");
            output = JSON.parse(jsonMatch[0]) as SimulationOutput;

            if (!output.narrative || !output.outcomes || !output.affectedAssets) {
              throw new Error("Incomplete simulation output structure");
            }

            const totalProb = output.outcomes.reduce((sum, o) => sum + o.probability, 0);
            if (Math.abs(totalProb - 1.0) > 0.05) {
              output.outcomes = output.outcomes.map((o) => ({
                ...o,
                probability: o.probability / totalProb,
              }));
            }

            sendEvent({ type: "complete", output });
          } catch (parseError) {
            console.error("[Simulate] JSON parse error:", parseError);
            const fallbackOutput: SimulationOutput = {
              narrative: fullText.slice(0, 2000),
              outcomes: [
                {
                  label: "Analysis Unavailable",
                  probability: 1.0,
                  description: "Full structured output could not be parsed.",
                },
              ],
              affectedAssets: [],
              recommendedHedges: [],
              tripwires: [],
              confidenceLevel: "low",
              analysisDepth: "Raw analysis — structured output parsing failed.",
            };
            sendEvent({ type: "complete", output: fallbackOutput });
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[Simulate] Streaming error:", error);
          const errMsg = error instanceof Error ? error.message : "Unknown error";
          sendEvent({ type: "error", error: errMsg });
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, { headers });
  } catch (error) {
    console.error("[Simulate] Setup error:", error);
    const errMsg = error instanceof Error ? error.message : "Setup failed";
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\ndata: [DONE]\n\n`,
      { status: 500, headers }
    );
  }
}
