-- =============================================================================
-- AXIOM Geopolitical Risk Intelligence Platform
-- Migration 001: Initial Schema
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================================================
-- Organizations
-- =============================================================================
CREATE TABLE IF NOT EXISTS orgs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'professional', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'trialing' CHECK (
    subscription_status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid')
  ),
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  signal_quota_daily       INTEGER NOT NULL DEFAULT 1000,
  simulation_quota_monthly INTEGER NOT NULL DEFAULT 50,
  simulations_used_this_month INTEGER NOT NULL DEFAULT 0,
  settings        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Users (extends Supabase auth.users)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('owner', 'admin', 'analyst', 'viewer')),
  avatar_url  TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id);

-- =============================================================================
-- Signals
-- =============================================================================
CREATE TABLE IF NOT EXISTS signals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES orgs(id) ON DELETE CASCADE,
  headline        TEXT NOT NULL,
  summary         TEXT,
  source          TEXT NOT NULL,
  source_url      TEXT,
  published_at    TIMESTAMPTZ NOT NULL,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity        TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO')),
  domain          TEXT NOT NULL CHECK (domain IN ('Military', 'Financial', 'Political', 'Humanitarian', 'Trade', 'Energy')),
  regions         TEXT[] NOT NULL DEFAULT '{}',
  countries       TEXT[] NOT NULL DEFAULT '{}',
  asset_classes   TEXT[] NOT NULL DEFAULT '{}',
  entities        TEXT[] NOT NULL DEFAULT '{}',
  sentiment_score FLOAT CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 1),
  embedding       vector(1536),
  raw_text        TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_signals_org_id ON signals(org_id);
CREATE INDEX IF NOT EXISTS idx_signals_published_at ON signals(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON signals(severity);
CREATE INDEX IF NOT EXISTS idx_signals_domain ON signals(domain);
CREATE INDEX IF NOT EXISTS idx_signals_regions ON signals USING GIN(regions);
CREATE INDEX IF NOT EXISTS idx_signals_countries ON signals USING GIN(countries);
CREATE INDEX IF NOT EXISTS idx_signals_source_url ON signals(source_url);
-- Vector similarity index for semantic search
CREATE INDEX IF NOT EXISTS idx_signals_embedding ON signals
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- =============================================================================
-- Risk Scores
-- =============================================================================
CREATE TABLE IF NOT EXISTS risk_scores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region            TEXT NOT NULL UNIQUE,
  country_codes     TEXT[] NOT NULL DEFAULT '{}',
  score             INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  trend             TEXT NOT NULL CHECK (trend IN ('rising', 'falling', 'stable')),
  trend_delta       INTEGER NOT NULL DEFAULT 0,
  signals_today     INTEGER NOT NULL DEFAULT 0,
  composite_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical risk score snapshots for trend analysis
CREATE TABLE IF NOT EXISTS risk_score_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region      TEXT NOT NULL,
  score       INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_score_history_region ON risk_score_history(region);
CREATE INDEX IF NOT EXISTS idx_risk_score_history_recorded_at ON risk_score_history(recorded_at DESC);

-- =============================================================================
-- Scenarios (Simulations)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scenarios (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  config        JSONB NOT NULL,
  output        JSONB,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  tokens_used   INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scenarios_org_id ON scenarios(org_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);
CREATE INDEX IF NOT EXISTS idx_scenarios_created_at ON scenarios(created_at DESC);

-- =============================================================================
-- Watchlists
-- =============================================================================
CREATE TABLE IF NOT EXISTS watchlists (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('region', 'country', 'signal_topic', 'entity')),
  value       TEXT NOT NULL,
  label       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, user_id, type, value)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_org_id ON watchlists(org_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);

-- =============================================================================
-- Alert Rules
-- =============================================================================
CREATE TABLE IF NOT EXISTS alert_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  condition       TEXT NOT NULL CHECK (condition IN ('risk_above', 'risk_below', 'signal_volume_above', 'severity_threshold')),
  threshold       FLOAT NOT NULL,
  target          TEXT NOT NULL,
  channels        TEXT[] NOT NULL DEFAULT '{in_app}',
  webhook_url     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_org_id ON alert_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_is_active ON alert_rules(is_active);

-- =============================================================================
-- Portfolio Holdings
-- =============================================================================
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  ticker              TEXT,
  asset_class         TEXT NOT NULL,
  region_exposure     JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_value_usd   BIGINT NOT NULL DEFAULT 0,
  risk_score          INTEGER,
  var_95              BIGINT,
  exposure_breakdown  JSONB DEFAULT '{}'::jsonb,
  last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_org_id ON portfolio_holdings(org_id);

-- =============================================================================
-- Research Corpus
-- =============================================================================
CREATE TABLE IF NOT EXISTS research_corpus (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES orgs(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  source          TEXT NOT NULL,
  document_type   TEXT NOT NULL CHECK (document_type IN ('report', 'news', 'academic', 'government', 'ngo', 'other')),
  regions         TEXT[] NOT NULL DEFAULT '{}',
  domains         TEXT[] NOT NULL DEFAULT '{}',
  published_at    TIMESTAMPTZ,
  ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  embedding       vector(1536),
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_research_corpus_org_id ON research_corpus(org_id);
CREATE INDEX IF NOT EXISTS idx_research_corpus_regions ON research_corpus USING GIN(regions);
CREATE INDEX IF NOT EXISTS idx_research_corpus_domains ON research_corpus USING GIN(domains);
CREATE INDEX IF NOT EXISTS idx_research_corpus_embedding ON research_corpus
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- =============================================================================
-- Notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('alert', 'simulation', 'signal', 'system')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================================================
-- Row Level Security Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_corpus ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's org_id
CREATE OR REPLACE FUNCTION get_current_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM users WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Org: users can only see their own org
CREATE POLICY "orgs_read_own" ON orgs
  FOR SELECT USING (id = get_current_org_id());

-- Users: can see members of their own org
CREATE POLICY "users_read_org" ON users
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- Signals: org isolation + global signals (org_id IS NULL)
CREATE POLICY "signals_read_org" ON signals
  FOR SELECT USING (org_id = get_current_org_id() OR org_id IS NULL);

CREATE POLICY "signals_insert_org" ON signals
  FOR INSERT WITH CHECK (org_id = get_current_org_id());

-- Risk scores: publicly readable
CREATE POLICY "risk_scores_read_all" ON risk_scores
  FOR SELECT USING (TRUE);

-- Scenarios: org isolation
CREATE POLICY "scenarios_read_org" ON scenarios
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "scenarios_insert_org" ON scenarios
  FOR INSERT WITH CHECK (org_id = get_current_org_id());

CREATE POLICY "scenarios_update_own" ON scenarios
  FOR UPDATE USING (org_id = get_current_org_id());

-- Watchlists: user isolation
CREATE POLICY "watchlists_read_own" ON watchlists
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "watchlists_insert_own" ON watchlists
  FOR INSERT WITH CHECK (org_id = get_current_org_id() AND user_id = auth.uid());

CREATE POLICY "watchlists_delete_own" ON watchlists
  FOR DELETE USING (user_id = auth.uid());

-- Alert rules: org isolation
CREATE POLICY "alert_rules_read_org" ON alert_rules
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "alert_rules_manage_own" ON alert_rules
  FOR ALL USING (org_id = get_current_org_id() AND user_id = auth.uid());

-- Portfolio holdings: org isolation
CREATE POLICY "portfolio_holdings_read_org" ON portfolio_holdings
  FOR SELECT USING (org_id = get_current_org_id());

CREATE POLICY "portfolio_holdings_manage_org" ON portfolio_holdings
  FOR ALL USING (org_id = get_current_org_id());

-- Research corpus: org isolation + global
CREATE POLICY "research_corpus_read_org" ON research_corpus
  FOR SELECT USING (org_id = get_current_org_id() OR org_id IS NULL);

-- Notifications: user isolation
CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- =============================================================================
-- Updated_at trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orgs_updated_at
  BEFORE UPDATE ON orgs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- pgvector similarity search functions
-- =============================================================================

-- Semantic signal search
CREATE OR REPLACE FUNCTION search_signals(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  org_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  headline TEXT,
  summary TEXT,
  severity TEXT,
  domain TEXT,
  regions TEXT[],
  published_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.headline,
    s.summary,
    s.severity,
    s.domain,
    s.regions,
    s.published_at,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM signals s
  WHERE
    (org_id_filter IS NULL OR s.org_id = org_id_filter OR s.org_id IS NULL)
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) > similarity_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Semantic research corpus search
CREATE OR REPLACE FUNCTION search_research_corpus(
  query_embedding vector(1536),
  similarity_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 10,
  org_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  source TEXT,
  document_type TEXT,
  regions TEXT[],
  published_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.title,
    r.content,
    r.source,
    r.document_type,
    r.regions,
    r.published_at,
    1 - (r.embedding <=> query_embedding) AS similarity
  FROM research_corpus r
  WHERE
    (org_id_filter IS NULL OR r.org_id = org_id_filter OR r.org_id IS NULL)
    AND r.embedding IS NOT NULL
    AND 1 - (r.embedding <=> query_embedding) > similarity_threshold
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
