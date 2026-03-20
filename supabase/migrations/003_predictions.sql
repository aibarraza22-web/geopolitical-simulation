-- =============================================================================
-- Migration 003: Predictions Table
-- AXIOM autonomous flashpoint prediction assessments
-- =============================================================================

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flashpoint TEXT NOT NULL UNIQUE,
  region_key TEXT NOT NULL,
  headline TEXT NOT NULL,
  probability INTEGER NOT NULL CHECK (probability >= 0 AND probability <= 100),
  timeframe TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH')),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  narrative TEXT NOT NULL,
  escalation_paths JSONB NOT NULL DEFAULT '[]',
  affected_assets JSONB NOT NULL DEFAULT '[]',
  key_indicators JSONB NOT NULL DEFAULT '[]',
  signal_count INTEGER NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_update TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes'
);

CREATE INDEX IF NOT EXISTS idx_predictions_flashpoint ON predictions(flashpoint);
CREATE INDEX IF NOT EXISTS idx_predictions_probability ON predictions(probability DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_severity ON predictions(severity);
CREATE INDEX IF NOT EXISTS idx_predictions_generated_at ON predictions(generated_at DESC);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "predictions_read_all" ON predictions
  FOR SELECT USING (TRUE);

CREATE POLICY "predictions_service_write" ON predictions
  FOR ALL USING (TRUE);
