import Anthropic from "@anthropic-ai/sdk";
import type { SimulationConfig, Signal, RiskScore, Prediction, EscalationPath, PredictionAsset } from "@/types";

// =============================================================================
// Client singleton
// =============================================================================
let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }
  return _client;
}

// =============================================================================
// Simulation prompt builder
// =============================================================================
export function buildSimulationPrompt(
  config: SimulationConfig,
  riskData: RiskScore[],
  recentSignals: Signal[],
  analogues: { title: string; summary: string; year: string }[] = []
): string {
  const riskContext = riskData
    .map(
      (r) =>
        `- ${r.region}: Risk Score ${r.score}/100 (${r.trend_delta > 0 ? "+" : ""}${r.trend_delta} 7d trend) | ${r.signals_today} signals today | Military:${r.composite_breakdown.military} Financial:${r.composite_breakdown.financial} Political:${r.composite_breakdown.political}`
    )
    .join("\n");

  const signalContext = recentSignals
    .slice(0, 10)
    .map(
      (s) =>
        `[${s.severity}][${s.domain}] ${s.headline} (Source: ${s.source}, Regions: ${s.regions.join(", ")})`
    )
    .join("\n");

  const analogueContext =
    analogues.length > 0
      ? analogues
          .map((a) => `- ${a.year}: ${a.title}\n  ${a.summary}`)
          .join("\n")
      : "- 1995-1996 Taiwan Strait Crisis: US carrier deployment deterred PLA military exercises\n- 2022 Russia-Ukraine invasion: Rapid escalation beyond intelligence community consensus\n- 1973 Arab Oil Embargo: Energy weaponization cascade across global markets";

  return `You are AXIOM, an advanced geopolitical risk intelligence system used by institutional investors and senior policy analysts. You have access to real-time intelligence signals, regional risk scores, and historical precedents.

CURRENT RISK CONTEXT:
${riskContext}

RECENT SIGNALS (last 48h):
${signalContext}

HISTORICAL ANALOGUES:
${analogueContext}

USER SCENARIO CONFIGURATION:
- Trigger Event: ${config.trigger_event}
- Primary Domain: ${config.domain}
- Analysis Time Horizon: ${config.time_horizon}
- Actor Set: ${config.actors.length > 0 ? config.actors.join(", ") : "All relevant state and non-state actors"}
- Focus Regions: ${config.regions.length > 0 ? config.regions.join(", ") : "All affected regions"}

INSTRUCTIONS:
Analyze this geopolitical scenario with the rigor of a senior intelligence analyst producing a report for a major institutional investor or government principal. Draw on historical precedents, current risk data, and systematic scenario analysis.

Return a JSON object with EXACTLY this structure (no markdown, pure JSON):
{
  "narrative": "2-3 dense analytical paragraphs covering the scenario dynamics, key actors, escalation pathways, and market implications",
  "outcomes": [
    {"label": "Concise outcome name", "probability": 0.XX, "description": "2-3 sentence description of how this outcome unfolds and its implications"},
    // 4-6 outcomes, probabilities must sum to exactly 1.0
  ],
  "affectedAssets": [
    {"asset": "Asset name (include ticker if public)", "direction": "positive|negative|neutral", "magnitude": "low|medium|high", "rationale": "1-2 sentence explanation"},
    // 5-10 assets across equities, currencies, commodities, fixed income
  ],
  "recommendedHedges": ["Specific hedge with instrument and rationale", ...],
  "tripwires": ["Observable event that would confirm escalation toward worst-case outcome", ...],
  "confidenceLevel": "low|medium|high",
  "analysisDepth": "Brief note on data sources, historical analogues, and analytical methodology used"
}`;
}

// =============================================================================
// NLP signal classification prompt
// =============================================================================
export function buildNLPPrompt(rawText: string): string {
  return `You are a geopolitical intelligence analyst. Classify the following news text and extract structured data.

TEXT:
${rawText.slice(0, 3000)}

Return a JSON object with EXACTLY this structure:
{
  "headline": "Concise, informative headline under 120 characters",
  "summary": "2-3 sentence analytical summary of the event and its significance",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "domain": "Military|Financial|Political|Humanitarian|Trade|Energy",
  "regions": ["Region names affected"],
  "countries": ["ISO alpha-2 country codes"],
  "asset_classes": ["Relevant asset classes: Equities, Bonds, Oil, Gas, Gold, Semiconductors, etc."],
  "entities": ["Key named entities: organizations, leaders, companies"],
  "sentiment_score": -1.0 to 1.0 (negative = bearish/concerning),
  "relevance_score": 0.0 to 1.0 (how geopolitically significant is this)
}

Rules:
- CRITICAL: Imminent armed conflict, nuclear threats, major market-moving geopolitical events
- HIGH: Significant escalation, major sanctions, political coups, large-scale humanitarian crises
- MEDIUM: Diplomatic tensions, economic pressure, protest movements, minor incidents
- LOW: Routine political developments, minor diplomatic exchanges
- INFO: Background context, policy statements, analysis pieces`;
}

// =============================================================================
// Flashpoint Prediction — Autonomous AXIOM Intelligence Assessment
// =============================================================================

interface FlashpointRiskData {
  score: number;
  trend: string;
  trend_delta: number;
  signals_today: number;
  composite_breakdown: Record<string, number>;
}

interface RecentSignalInput {
  headline: string;
  source: string;
  severity: string;
  domain: string;
  published_at: string;
}

interface ResearchExcerpt {
  title: string;
  content: string;
}

interface PredictionJsonRaw {
  headline: string;
  probability: number;
  timeframe: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  narrative: string;
  escalation_paths: EscalationPath[];
  key_indicators: string[];
  affected_assets: PredictionAsset[];
}

export async function generateFlashpointPrediction(
  flashpoint: string,
  regionKey: string,
  riskData: FlashpointRiskData | null,
  recentSignals: RecentSignalInput[],
  historicalContext: ResearchExcerpt[]
): Promise<Omit<Prediction, "id" | "generated_at" | "next_update">> {
  const anthropic = getAnthropicClient();

  const breakdown = riskData?.composite_breakdown
    ? Object.entries(riskData.composite_breakdown)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")
    : "N/A";

  const signalsText =
    recentSignals.length > 0
      ? recentSignals
          .map(
            (s, i) =>
              `${i + 1}. [${s.severity}][${s.domain}] ${s.headline} — ${s.source} (${s.published_at})`
          )
          .join("\n")
      : "No recent signals available.";

  const historyText =
    historicalContext.length > 0
      ? historicalContext
          .map((r) => `--- ${r.title} ---\n${r.content.slice(0, 600)}`)
          .join("\n\n")
      : "No historical corpus available.";

  const prompt = `You are AXIOM, an advanced geopolitical intelligence system used by institutional investors, hedge funds, and policy analysts.

Your task is to generate a forward-looking predictive intelligence assessment for the ${flashpoint} flashpoint.

CURRENT RISK DATA:
- Risk Score: ${riskData?.score ?? "N/A"}/100 (trend: ${riskData?.trend ?? "N/A"}, delta: ${riskData?.trend_delta ?? 0} over 7 days)
- Signals in last 48h: ${recentSignals.length}
- Domain breakdown: ${breakdown}

RECENT SIGNALS (last 48h, ordered by severity):
${signalsText}

HISTORICAL CONTEXT:
${historyText}

Generate a detailed predictive assessment. Return ONLY valid JSON with this exact structure (no markdown, no code fences, pure JSON):
{
  "headline": "one sharp sentence predicting the most likely near-term development",
  "probability": <integer 0-100, probability of significant escalation>,
  "timeframe": "14 days",
  "confidence": "HIGH",
  "narrative": "Three detailed paragraphs separated by \\n\\n. Paragraph 1: current dynamics and actors. Paragraph 2: historical patterns and precedents. Paragraph 3: forward trajectory and market implications. Be specific — name actors, weapons systems, geographic locations, financial instruments.",
  "escalation_paths": [
    {
      "label": "scenario name",
      "probability": <0-1, all paths must sum to exactly 1.0>,
      "timeframe": "X days/weeks",
      "description": "2-3 sentences on how this plays out",
      "impact_level": "CATASTROPHIC",
      "asset_impacts": [{"asset": "Brent Crude", "direction": "up", "magnitude": "high"}]
    }
  ],
  "key_indicators": ["specific thing to watch 1", "specific thing to watch 2", "specific thing to watch 3", "specific thing to watch 4", "specific thing to watch 5"],
  "affected_assets": [{"asset": "Brent Crude", "direction": "up", "magnitude": "high", "rationale": "1-2 sentence explanation"}]
}

Rules:
- escalation_paths must include 4-6 paths covering the full outcome spectrum from de-escalation to catastrophic escalation
- escalation_paths probabilities must sum to exactly 1.0
- probability field is an integer 0-100 representing escalation likelihood
- confidence must be HIGH, MEDIUM, or LOW (uppercase)
- timeframe for the headline prediction should be one of: "7 days", "14 days", "30 days", "60 days", "90 days"`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const rawText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in Claude response for flashpoint: ${flashpoint}`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as PredictionJsonRaw;

  // Normalize escalation_paths probabilities to sum to 1
  const totalProb = parsed.escalation_paths.reduce((s, p) => s + p.probability, 0);
  if (Math.abs(totalProb - 1.0) > 0.02 && totalProb > 0) {
    parsed.escalation_paths = parsed.escalation_paths.map((p) => ({
      ...p,
      probability: p.probability / totalProb,
    }));
  }

  // Derive severity from probability
  const severity =
    parsed.probability >= 75
      ? "CRITICAL"
      : parsed.probability >= 55
      ? "HIGH"
      : parsed.probability >= 35
      ? "MEDIUM"
      : "LOW";

  return {
    flashpoint,
    region_key: regionKey,
    headline: parsed.headline,
    probability: parsed.probability,
    timeframe: parsed.timeframe,
    confidence: parsed.confidence,
    severity: severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
    narrative: parsed.narrative,
    escalation_paths: parsed.escalation_paths,
    affected_assets: parsed.affected_assets,
    key_indicators: parsed.key_indicators,
    signal_count: recentSignals.length,
  };
}

// =============================================================================
// Historical analogue search (placeholder for pgvector impl)
// =============================================================================
export const HISTORICAL_ANALOGUES = [
  {
    title: "1995-1996 Taiwan Strait Crisis",
    summary:
      "China conducted missile tests near Taiwan ahead of its first democratic presidential election. US deployed two carrier strike groups. Crisis de-escalated without armed conflict.",
    year: "1995-1996",
  },
  {
    title: "2022 Russia-Ukraine Full-Scale Invasion",
    summary:
      "Russia launched comprehensive invasion of Ukraine despite Western deterrence efforts. Energy and commodity markets severely disrupted. NATO alliance solidified unexpectedly.",
    year: "2022",
  },
  {
    title: "1973 Arab Oil Embargo",
    summary:
      "OPEC Arab members imposed oil embargo on US and allies supporting Israel. Oil prices quadrupled. Global recession followed. Long-term shift in energy policy.",
    year: "1973",
  },
  {
    title: "2006 Israel-Hezbollah War",
    summary:
      "34-day conflict following Hezbollah cross-border raid. Israeli ground invasion of southern Lebanon. 1,200 Lebanese and 165 Israeli fatalities.",
    year: "2006",
  },
  {
    title: "2019 Saudi Aramco Houthi Drone Attack",
    summary:
      "Drone strikes on Abqaiq and Khurais facilities halted 5.7M bpd (5% of global supply). Oil prices spiked 15% but recovered within weeks as damage was contained.",
    year: "2019",
  },
];
