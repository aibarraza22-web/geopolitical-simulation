-- =============================================================================
-- AXIOM Platform — Seed Data
-- Migration 002: Risk scores, demo org, and initial research corpus
-- =============================================================================

-- =============================================================================
-- Demo organization
-- =============================================================================
INSERT INTO orgs (
  id,
  name,
  slug,
  plan,
  subscription_status,
  signal_quota_daily,
  simulation_quota_monthly,
  simulations_used_this_month
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'AXIOM Demo Organization',
  'axiom-demo',
  'enterprise',
  'active',
  50000,
  500,
  127
) ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- Seed Risk Scores — 8 flashpoint regions
-- =============================================================================
INSERT INTO risk_scores (region, country_codes, score, trend, trend_delta, signals_today, composite_breakdown, calculated_at)
VALUES
  (
    'Ukraine-Russia',
    ARRAY['UA', 'RU', 'BY'],
    91,
    'falling',
    -3,
    67,
    '{"military": 95, "financial": 88, "political": 92, "humanitarian": 89, "trade": 75, "energy": 85}'::jsonb,
    NOW()
  ),
  (
    'Taiwan Strait',
    ARRAY['TW', 'CN'],
    87,
    'rising',
    12,
    34,
    '{"military": 92, "financial": 84, "political": 90, "humanitarian": 55, "trade": 88, "energy": 70}'::jsonb,
    NOW()
  ),
  (
    'Iran-Israel',
    ARRAY['IR', 'IL'],
    83,
    'rising',
    20,
    52,
    '{"military": 90, "financial": 72, "political": 88, "humanitarian": 78, "trade": 65, "energy": 82}'::jsonb,
    NOW()
  ),
  (
    'Middle East',
    ARRAY['SA', 'YE', 'IQ', 'SY', 'LB', 'JO', 'EG'],
    78,
    'rising',
    8,
    45,
    '{"military": 82, "financial": 68, "political": 80, "humanitarian": 85, "trade": 72, "energy": 88}'::jsonb,
    NOW()
  ),
  (
    'South China Sea',
    ARRAY['CN', 'PH', 'VN', 'MY', 'BN'],
    72,
    'rising',
    5,
    28,
    '{"military": 78, "financial": 65, "political": 75, "humanitarian": 45, "trade": 80, "energy": 70}'::jsonb,
    NOW()
  ),
  (
    'Sahel Region',
    ARRAY['ML', 'BF', 'NE', 'TD', 'MR'],
    68,
    'rising',
    15,
    19,
    '{"military": 72, "financial": 58, "political": 74, "humanitarian": 80, "trade": 55, "energy": 60}'::jsonb,
    NOW()
  ),
  (
    'Korean Peninsula',
    ARRAY['KP', 'KR'],
    61,
    'rising',
    2,
    12,
    '{"military": 72, "financial": 50, "political": 68, "humanitarian": 55, "trade": 58, "energy": 48}'::jsonb,
    NOW()
  ),
  (
    'Venezuela',
    ARRAY['VE'],
    55,
    'falling',
    -5,
    8,
    '{"military": 55, "financial": 60, "political": 65, "humanitarian": 70, "trade": 45, "energy": 58}'::jsonb,
    NOW()
  )
ON CONFLICT (region) DO UPDATE SET
  score = EXCLUDED.score,
  trend = EXCLUDED.trend,
  trend_delta = EXCLUDED.trend_delta,
  signals_today = EXCLUDED.signals_today,
  composite_breakdown = EXCLUDED.composite_breakdown,
  calculated_at = EXCLUDED.calculated_at,
  updated_at = NOW();

-- =============================================================================
-- Seed risk score history (30-day trend data)
-- =============================================================================
INSERT INTO risk_score_history (region, score, recorded_at)
SELECT
  r.region,
  r.base_score + (RANDOM() * 10 - 5)::INTEGER AS score,
  NOW() - (d.day || ' days')::INTERVAL AS recorded_at
FROM (VALUES
  ('Ukraine-Russia', 91),
  ('Taiwan Strait', 87),
  ('Iran-Israel', 83),
  ('Middle East', 78),
  ('South China Sea', 72),
  ('Sahel Region', 68),
  ('Korean Peninsula', 61),
  ('Venezuela', 55)
) AS r(region, base_score)
CROSS JOIN (
  SELECT generate_series(1, 30) AS day
) AS d
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Seed research corpus documents
-- =============================================================================
INSERT INTO research_corpus (
  org_id,
  title,
  content,
  source,
  document_type,
  regions,
  domains,
  published_at
) VALUES
  (
    NULL,
    'Taiwan Strait Crisis Scenarios: Military Balance 2024',
    'Comprehensive assessment of PLA military modernization and its implications for cross-strait deterrence. The report covers naval order of battle, amphibious capabilities including Type 075 LHDs, missile forces (DF-21D/DF-26 anti-ship ballistic missiles), and emerging cyber and space dimensions. Analysis includes wargame findings from multiple RAND Corporation scenarios conducted 2022-2024. Key finding: US intervention windows narrow significantly by 2027 as PLA anti-access/area-denial capabilities mature.',
    'RAND Corporation',
    'report',
    ARRAY['Taiwan Strait'],
    ARRAY['Military', 'Political'],
    NOW() - INTERVAL '30 days'
  ),
  (
    NULL,
    'Semiconductor Supply Chain Resilience Under Geopolitical Stress',
    'TSMC produces approximately 92% of the world most advanced semiconductor nodes (below 7nm). A Taiwan conflict would eliminate this capacity for 2-5 years minimum. No existing or planned fab can substitute at scale. Apple, NVIDIA, AMD, Qualcomm, and Intel all face existential supply disruption. South Korean alternative (Samsung) operates at 60% of TSMC advanced node capacity. Intel Arizona fabs remain 3+ years from advanced node production.',
    'McKinsey Global Institute',
    'report',
    ARRAY['Taiwan Strait', 'South China Sea'],
    ARRAY['Trade', 'Financial'],
    NOW() - INTERVAL '45 days'
  ),
  (
    NULL,
    'Iranian Nuclear Program: Breakout Timeline Assessment Q4 2024',
    'Iran has accelerated enrichment to 84% at Fordow underground facility. IAEA inspector access remains limited. Estimated breakout time to first device: 2-3 weeks at current enrichment levels given sufficient highly enriched uranium stockpile. Weaponization timeline (miniaturized warhead for Shahab-3/Emad missile): 12-18 additional months. Diplomatic track via JCPOA revival considered effectively dead following 2023 IAEA censure.',
    'Institute for Science and International Security',
    'academic',
    ARRAY['Iran-Israel', 'Middle East'],
    ARRAY['Military', 'Political'],
    NOW() - INTERVAL '15 days'
  ),
  (
    NULL,
    'European Energy Security Post-Nordstream: 2024 Assessment',
    'European natural gas storage at 89% heading into winter 2024. LNG import capacity additions (Germany, Netherlands, Italy) now cover ~55% of former Russian pipeline volumes. Remaining gap filled by Norwegian increases, Azeri Southern Corridor, and Algerian supplies. Structural vulnerability remains: cold snap + industrial demand surge could deplete storage in 40-50 days. German industrial competitiveness permanently impaired by 2x pre-war energy costs.',
    'International Energy Agency',
    'government',
    ARRAY['Ukraine-Russia'],
    ARRAY['Energy', 'Financial'],
    NOW() - INTERVAL '20 days'
  ),
  (
    NULL,
    'Sahel Security Vacuum: Russia Africa Corps Expansion Assessment',
    'Russia Africa Corps (successor to Wagner Group) has established operational presence in 12 African nations. Mali, Burkina Faso, and Niger represent core hub. Estimated 6,000-8,000 personnel deployed across continent. Primary revenue model: mining concessions (gold, uranium, diamonds) plus state security contracts. French intelligence estimates $2.5B annual revenue. European counter-terrorism cooperation frameworks (Barkhane, Takuba) fully collapsed.',
    'European External Action Service',
    'government',
    ARRAY['Sahel Region'],
    ARRAY['Military', 'Political'],
    NOW() - INTERVAL '10 days'
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Verify seed data
-- =============================================================================
DO $$
DECLARE
  risk_score_count INTEGER;
  corpus_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO risk_score_count FROM risk_scores;
  SELECT COUNT(*) INTO corpus_count FROM research_corpus;

  RAISE NOTICE 'Seed complete: % risk scores, % research documents', risk_score_count, corpus_count;
END;
$$;
