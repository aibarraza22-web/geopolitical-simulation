import type { Signal, RiskScore, SignalSeverity } from "@/types";

// Severity weights — logarithmically spaced to reflect real-world impact differences
const SEVERITY_WEIGHTS: Record<SignalSeverity, number> = {
  CRITICAL: 10.0, // Active war, invasion, nuclear threat, mass casualty event
  HIGH:      5.0,  // Significant escalation, major strike, coup attempt
  MEDIUM:    2.0,  // Heightened tension, military deployment, protest surge
  LOW:       0.8,  // Diplomatic friction, minor skirmish, sanctions talk
  INFO:      0.2,  // Background monitoring, routine activity
};

// Domain importance for geopolitical risk assessment
const DOMAIN_WEIGHTS: Record<string, number> = {
  Military:     1.00,
  Political:    0.85,
  Energy:       0.80,
  Financial:    0.75,
  Trade:        0.65,
  Humanitarian: 0.55,
};

// Score a single domain based on its signals.
// Peak severity of worst signal drives the score — volume adds a log-scaled bonus.
function scoreDomain(domainSigs: Signal[]): number {
  if (domainSigs.length === 0) return 0;

  const peakWeight = Math.max(
    ...domainSigs.map((s) => {
      const base = SEVERITY_WEIGHTS[s.severity];
      // Negative sentiment amplifies score (hostile events matter more)
      const sentimentAmplifier = 1 + Math.abs(Math.min(0, s.sentiment_score)) * 0.3;
      return base * sentimentAmplifier * Math.max(0.3, s.relevance_score);
    })
  );

  // CRITICAL peak → raw ~10, scaled to 0-85 range
  const peakScore = Math.min(85, peakWeight * 7.5);

  // Volume bonus: diminishing returns after ~10 signals, max +15
  const volumeBonus = Math.min(15, Math.log1p(domainSigs.length) * 4.5);

  return Math.min(100, peakScore + volumeBonus);
}

export function calculateRiskScore(
  region: string,
  signals: Signal[],
  previousScore = 0,
  marketStressIndicator = 0
): Pick<RiskScore, "score" | "composite_breakdown"> {
  if (signals.length === 0) {
    // No signals = no score. Don't carry forward seeded or stale data.
    return {
      score: 0,
      composite_breakdown: { military: 0, financial: 0, political: 0, humanitarian: 0, trade: 0, energy: 0 },
    };
  }

  const domainSignals = {
    military:     signals.filter((s) => s.domain === "Military"),
    financial:    signals.filter((s) => s.domain === "Financial"),
    political:    signals.filter((s) => s.domain === "Political"),
    humanitarian: signals.filter((s) => s.domain === "Humanitarian"),
    trade:        signals.filter((s) => s.domain === "Trade"),
    energy:       signals.filter((s) => s.domain === "Energy"),
  };

  const breakdown = {
    military:     scoreDomain(domainSignals.military),
    financial:    scoreDomain(domainSignals.financial),
    political:    scoreDomain(domainSignals.political),
    humanitarian: scoreDomain(domainSignals.humanitarian),
    trade:        scoreDomain(domainSignals.trade),
    energy:       scoreDomain(domainSignals.energy),
  };

  // Composite score: driven by the two highest-scoring domains.
  // Using top-2 avoids low-signal domains (e.g. energy=7) dragging down
  // regions with genuinely high multi-domain activity (e.g. Iran-Israel military+political).
  // A region with two CRITICAL domains scores higher than one with one CRITICAL domain.
  const domainScoresSorted = Object.values(breakdown).sort((a, b) => b - a);
  const top1 = domainScoresSorted[0] ?? 0;
  const top2 = domainScoresSorted[1] ?? top1; // falls back to top1 if only one domain active

  // 60% from peak domain, 40% from average of top-2
  const breadthScore = (top1 + top2) / 2;
  let compositeScore = top1 * 0.6 + breadthScore * 0.4;

  compositeScore += marketStressIndicator * 10;

  // Minimal momentum blend — 95% live data, 5% previous score.
  // We don't want stale data to persist; current signals should dominate.
  const blendedScore = compositeScore * 0.95 + previousScore * 0.05;
  const finalScore = Math.round(Math.max(0, Math.min(100, blendedScore)));

  return {
    score: finalScore,
    composite_breakdown: {
      military:     Math.round(breakdown.military),
      financial:    Math.round(breakdown.financial),
      political:    Math.round(breakdown.political),
      humanitarian: Math.round(breakdown.humanitarian),
      trade:        Math.round(breakdown.trade),
      energy:       Math.round(breakdown.energy),
    },
  };
}

export function calculatePortfolioExposure(
  regionExposure: Record<string, number>,
  riskScores: Map<string, number>
): number {
  let weightedRisk = 0;
  let totalWeight = 0;
  for (const [region, weight] of Object.entries(regionExposure)) {
    const score = riskScores.get(region) ?? 0;
    weightedRisk += score * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weightedRisk / totalWeight);
}

export function calculateSignalVelocity(signals: Signal[], windowHours = 24): number {
  const cutoff = new Date(Date.now() - windowHours * 3600000);
  const recent = signals.filter((s) => new Date(s.published_at) > cutoff);
  return recent.length / windowHours;
}

export function determineTrend(
  currentScore: number,
  historicalScores: number[]
): { trend: "rising" | "falling" | "stable"; delta: number } {
  if (historicalScores.length === 0) return { trend: "stable", delta: 0 };
  const avg = historicalScores.reduce((a, b) => a + b, 0) / historicalScores.length;
  const delta = Math.round(currentScore - avg);
  if (delta >= 3) return { trend: "rising", delta };
  if (delta <= -3) return { trend: "falling", delta };
  return { trend: "stable", delta };
}
