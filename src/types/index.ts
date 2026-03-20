// =============================================================================
// AXIOM Platform — TypeScript Types
// =============================================================================

export type SignalSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export type SignalDomain =
  | "Military"
  | "Financial"
  | "Political"
  | "Humanitarian"
  | "Trade"
  | "Energy";

export type RiskTrend = "rising" | "falling" | "stable";

export type ConfidenceLevel = "low" | "medium" | "high";

export type AssetDirection = "positive" | "negative" | "neutral";

export type MagnitudeLevel = "low" | "medium" | "high";

export type SubscriptionPlan = "starter" | "professional" | "enterprise";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid";

export type AlertCondition =
  | "risk_above"
  | "risk_below"
  | "signal_volume_above"
  | "severity_threshold";

// =============================================================================
// Core Data Types
// =============================================================================

export interface Signal {
  id: string;
  org_id: string;
  headline: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string;
  ingested_at: string;
  severity: SignalSeverity;
  domain: SignalDomain;
  regions: string[];
  countries: string[];
  asset_classes: string[];
  entities: string[];
  sentiment_score: number; // -1 to 1
  relevance_score: number; // 0 to 1
  embedding?: number[];
  raw_text?: string;
}

export interface RiskScore {
  id: string;
  region: string;
  country_codes: string[];
  score: number; // 0-100
  trend: RiskTrend;
  trend_delta: number; // change over 7 days
  signals_today: number;
  composite_breakdown: {
    military: number;
    financial: number;
    political: number;
    humanitarian: number;
    trade: number;
    energy: number;
  };
  calculated_at: string;
  top_signals: Signal[];
}

export interface RegionRiskData {
  region: string;
  country_codes: string[];
  risk_score: number;
  trend: RiskTrend;
  trend_delta: number;
  signals_today: number;
  latitude: number;
  longitude: number;
  top_signals: Pick<Signal, "id" | "headline" | "severity" | "published_at">[];
}

// =============================================================================
// Organization & User
// =============================================================================

export interface Org {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  signal_quota_daily: number;
  simulation_quota_monthly: number;
  simulations_used_this_month: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: "owner" | "admin" | "analyst" | "viewer";
  avatar_url: string | null;
  created_at: string;
  last_seen_at: string | null;
}

// =============================================================================
// Simulation
// =============================================================================

export interface SimulationConfig {
  trigger_event: string;
  domain: SignalDomain;
  time_horizon: "24h" | "7d" | "30d" | "90d" | "1y";
  actors: string[];
  regions: string[];
}

export interface OutcomeBranch {
  label: string;
  probability: number;
  description: string;
}

export interface AffectedAsset {
  asset: string;
  direction: AssetDirection;
  magnitude: MagnitudeLevel;
  rationale: string;
}

export interface SimulationOutput {
  narrative: string;
  outcomes: OutcomeBranch[];
  affectedAssets: AffectedAsset[];
  recommendedHedges: string[];
  tripwires: string[];
  confidenceLevel: ConfidenceLevel;
  analysisDepth: string;
}

export interface Scenario {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  config: SimulationConfig;
  output: SimulationOutput | null;
  status: "pending" | "running" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  tokens_used: number;
}

// =============================================================================
// Portfolio
// =============================================================================

export interface PortfolioHolding {
  id: string;
  org_id: string;
  name: string;
  ticker: string | null;
  asset_class: string;
  region_exposure: Record<string, number>; // region -> weight (0-1)
  current_value_usd: number;
  risk_score: number; // 0-100
  var_95: number; // Value at Risk 95% confidence
  exposure_breakdown: {
    military: number;
    financial: number;
    political: number;
    humanitarian: number;
    trade: number;
    energy: number;
  };
}

// =============================================================================
// Watchlist & Alerts
// =============================================================================

export interface WatchlistItem {
  id: string;
  org_id: string;
  user_id: string;
  type: "region" | "country" | "signal_topic" | "entity";
  value: string;
  label: string;
  created_at: string;
}

export interface AlertRule {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  target: string; // region or topic
  channels: ("email" | "webhook" | "in_app")[];
  webhook_url: string | null;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

// =============================================================================
// Research Corpus
// =============================================================================

export interface ResearchDocument {
  id: string;
  org_id: string;
  title: string;
  content: string;
  source: string;
  document_type:
    | "report"
    | "news"
    | "academic"
    | "government"
    | "ngo"
    | "other";
  regions: string[];
  domains: SignalDomain[];
  published_at: string;
  ingested_at: string;
  embedding?: number[];
  similarity?: number;
}

// =============================================================================
// Predictions — Autonomous AXIOM Intelligence Assessments
// =============================================================================

export type PredictionSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type PredictionConfidence = "LOW" | "MEDIUM" | "HIGH";
export type ImpactLevel = "CATASTROPHIC" | "SEVERE" | "MODERATE" | "LOW";

export interface EscalationPath {
  label: string;
  probability: number; // 0-1, all paths sum to 1
  timeframe: string;
  description: string;
  impact_level: ImpactLevel;
  asset_impacts: {
    asset: string;
    direction: "up" | "down";
    magnitude: "high" | "medium" | "low";
  }[];
}

export interface PredictionAsset {
  asset: string;
  direction: "up" | "down";
  magnitude: "high" | "medium" | "low";
  rationale: string;
}

export interface Prediction {
  id: string;
  flashpoint: string; // "Iran-Israel", "Taiwan Strait", etc.
  region_key: string;
  headline: string; // "Direct missile exchange likely within 21 days"
  probability: number; // 0-100
  timeframe: string; // "7 days" | "14 days" | "30 days" | "60 days" | "90 days"
  confidence: PredictionConfidence;
  severity: PredictionSeverity;
  narrative: string; // 2-3 paragraph deep analysis
  escalation_paths: EscalationPath[];
  affected_assets: PredictionAsset[];
  key_indicators: string[]; // what to watch for
  signal_count: number; // how many signals informed this
  generated_at: string;
  next_update: string;
}

// =============================================================================
// API Response Wrappers
// =============================================================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  meta?: {
    total: number;
    page: number;
    page_size: number;
  };
}

export interface StreamChunk {
  type: "delta" | "complete" | "error";
  content?: string;
  output?: SimulationOutput;
  error?: string;
}

// =============================================================================
// UI State Types
// =============================================================================

export interface MapLayer {
  id: string;
  label: string;
  domain: SignalDomain;
  color: string;
  enabled: boolean;
}

export interface KPICard {
  label: string;
  value: string | number;
  delta: string;
  deltaDirection: "up" | "down" | "neutral";
  color: string;
}

export interface NotificationItem {
  id: string;
  type: "alert" | "simulation" | "signal" | "system";
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}
