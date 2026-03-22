// =============================================================================
// AXIOM Monte Carlo + Markov Chain Simulation Engine
// =============================================================================

export type MarkovState =
  | "detente"
  | "stable"
  | "elevated"
  | "crisis"
  | "conflict"
  | "war";

export const STATES: MarkovState[] = [
  "detente",
  "stable",
  "elevated",
  "crisis",
  "conflict",
  "war",
];

export const STATE_LABELS: Record<MarkovState, string> = {
  detente: "Détente",
  stable: "Stable",
  elevated: "Elevated Tension",
  crisis: "Crisis",
  conflict: "Limited Conflict",
  war: "Full Conflict",
};

export const STATE_COLORS: Record<MarkovState, string> = {
  detente: "#4ade80",
  stable: "#86efac",
  elevated: "#fbbf24",
  crisis: "#f97316",
  conflict: "#ef4444",
  war: "#991b1b",
};

// Time steps per horizon
export const HORIZON_STEPS: Record<string, number> = {
  "24h": 6,
  "7d": 7,
  "30d": 12,
  "90d": 18,
  "1y": 24,
};

type TransitionMatrix = number[][];

// Build a 6×6 transition matrix from risk score + signal sentiment + agent modifier
export function buildTransitionMatrix(
  riskScore: number, // 0-100
  avgSentiment: number, // -1 to 1 (negative = hostile)
  agentModifier: number = 0 // net escalation shift from agent decisions
): TransitionMatrix {
  const escalation = Math.min(
    0.85,
    (riskScore / 100) * 0.5 + Math.max(0, -avgSentiment) * 0.25 + agentModifier * 0.25
  );
  const deEscalation = Math.max(0.02, (1 - escalation) * 0.2);

  // Row i = current state, col j = next state
  // States: 0=détente 1=stable 2=elevated 3=crisis 4=conflict 5=war
  const raw: TransitionMatrix = [
    // From détente
    [0.75 - escalation * 0.2, 0.15 + escalation * 0.15, escalation * 0.1, 0, 0, 0],
    // From stable
    [deEscalation * 0.3, 0.7 - escalation * 0.2, 0.2 + escalation * 0.15, escalation * 0.1, 0, 0],
    // From elevated
    [0, deEscalation * 0.3, 0.55 - escalation * 0.15, 0.3 + escalation * 0.1, escalation * 0.1, 0],
    // From crisis
    [0, 0, deEscalation * 0.25, 0.5 - escalation * 0.15, 0.3 + escalation * 0.1, escalation * 0.15],
    // From conflict
    [0, 0, 0, deEscalation * 0.15, 0.55 - escalation * 0.1, 0.45 + escalation * 0.1],
    // From war (absorbing with slim ceasefire chance)
    [0, 0, 0, deEscalation * 0.05, 0.15, 0.85 - deEscalation * 0.05],
  ];

  // Normalize each row to sum exactly to 1
  return raw.map((row) => {
    const sum = row.reduce((a, b) => a + b, 0);
    return row.map((v) => Math.max(0, v) / sum);
  });
}

export function getInitialStateIndex(riskScore: number): number {
  if (riskScore < 20) return 0; // détente
  if (riskScore < 35) return 1; // stable
  if (riskScore < 55) return 2; // elevated
  if (riskScore < 70) return 3; // crisis
  if (riskScore < 85) return 4; // conflict
  return 5;                     // war
}

function sampleNext(row: number[]): number {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < row.length; i++) {
    cum += row[i];
    if (r <= cum) return i;
  }
  return row.length - 1;
}

function runOneSim(
  initialState: number,
  matrix: TransitionMatrix,
  steps: number
): number[] {
  const path = [initialState];
  let cur = initialState;
  for (let i = 0; i < steps; i++) {
    cur = sampleNext(matrix[cur]);
    path.push(cur);
  }
  return path;
}

export interface MonteCarloResult {
  initialState: MarkovState;
  finalStateDistribution: Record<MarkovState, number>;
  peakStateDistribution: Record<MarkovState, number>;
  mostLikelyFinalState: MarkovState;
  worstCaseState: MarkovState;
  pathDistribution: { label: string; probability: number }[];
  trajectoryData: Array<{ step: number } & Record<MarkovState, number>>;
  simCount: number;
  transitionMatrix: TransitionMatrix;
}

export function runMonteCarlo(
  riskScore: number,
  signals: { sentiment_score: number }[],
  timeHorizon: string,
  simCount = 10000,
  agentModifier = 0
): MonteCarloResult {
  const avgSentiment =
    signals.length > 0
      ? signals.reduce((s, sig) => s + sig.sentiment_score, 0) / signals.length
      : 0;

  const matrix = buildTransitionMatrix(riskScore, avgSentiment, agentModifier);
  const steps = HORIZON_STEPS[timeHorizon] ?? 12;
  const initialIdx = getInitialStateIndex(riskScore);

  const finalCounts = new Array(6).fill(0);
  const peakCounts = new Array(6).fill(0);
  const stepAccum: number[][] = Array.from({ length: steps + 1 }, () =>
    new Array(6).fill(0)
  );
  const pathMap = new Map<string, number>();

  for (let s = 0; s < simCount; s++) {
    const path = runOneSim(initialIdx, matrix, steps);
    finalCounts[path[path.length - 1]]++;
    const peak = Math.max(...path);
    peakCounts[peak]++;
    path.forEach((state, step) => stepAccum[step][state]++);
    const key = `${path[0]}-${peak}-${path[path.length - 1]}`;
    pathMap.set(key, (pathMap.get(key) ?? 0) + 1);
  }

  const toDistrib = (counts: number[]): Record<MarkovState, number> =>
    Object.fromEntries(
      STATES.map((s, i) => [s, counts[i] / simCount])
    ) as Record<MarkovState, number>;

  const finalDist = toDistrib(finalCounts);
  const peakDist = toDistrib(peakCounts);

  const mostLikelyFinalState =
    STATES[finalCounts.indexOf(Math.max(...finalCounts))];

  // Worst case = highest state that appeared in ≥5% of simulations
  let worstCaseState: MarkovState = STATES[initialIdx];
  for (let i = STATES.length - 1; i >= 0; i--) {
    if (peakCounts[i] / simCount >= 0.05) {
      worstCaseState = STATES[i];
      break;
    }
  }

  // Top 5 paths
  const pathDistribution = [...pathMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const [from, peak, to] = key.split("-").map(Number);
      const fromLabel = STATE_LABELS[STATES[from]];
      const peakLabel = STATE_LABELS[STATES[peak]];
      const toLabel = STATE_LABELS[STATES[to]];
      const label =
        peak !== from && peak !== to
          ? `${fromLabel} → ${peakLabel} → ${toLabel}`
          : `${fromLabel} → ${toLabel}`;
      return { label, probability: count / simCount };
    });

  // Trajectory chart data
  const trajectoryData: Array<{ step: number } & Record<MarkovState, number>> =
    stepAccum.map((counts, step) => {
      const entry = { step } as { step: number } & Record<MarkovState, number>;
      STATES.forEach((state, i) => {
        entry[state] = counts[i] / simCount;
      });
      return entry;
    });

  return {
    initialState: STATES[initialIdx],
    finalStateDistribution: finalDist,
    peakStateDistribution: peakDist,
    mostLikelyFinalState,
    worstCaseState,
    pathDistribution,
    trajectoryData,
    simCount,
    transitionMatrix: matrix,
  };
}
