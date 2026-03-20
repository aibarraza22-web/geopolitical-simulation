/**
 * Signal ingestion + risk scoring — no Claude dependency.
 * Rule-based NLP is fast, free, and runs continuously.
 * Claude is reserved for predictions and scenario simulations only.
 */

import { createClient } from "@supabase/supabase-js";
import { fetchAllGdeltSignals } from "../lib/signal-processors/gdelt";
import { calculateRiskScore, determineTrend } from "../lib/risk-engine";
import type { Signal, RiskScore } from "../types";

// Default ISO country codes per region for map marker placement.
// Stable geography — doesn't go stale.
const REGION_DEFAULT_CODES: Record<string, string[]> = {
  "Iran-Israel":      ["IR", "IL"],
  "Ukraine-Russia":   ["UA", "RU"],
  "Taiwan Strait":    ["TW", "CN"],
  "Middle East":      ["SA", "YE", "IQ", "SY", "LB", "JO"],
  "South China Sea":  ["CN", "PH", "VN", "MY"],
  "Korean Peninsula": ["KP", "KR"],
  "Sahel Region":     ["ML", "BF", "NE", "TD", "MR"],
  "South Asia":       ["PK", "IN", "AF"],
  "East Africa":      ["SO", "ET", "KE", "SD"],
  "Central Africa":   ["CD", "CF", "CM"],
  "West Africa":      ["NG", "GH", "SN"],
  "Latin America":    ["MX", "GT", "HN", "NI"],
  "South America":    ["VE", "CO", "BR", "AR"],
  "Eastern Europe":   ["RS", "GE", "AM", "AZ"],
  "North Africa":     ["LY", "TN", "DZ", "MA"],
  "Southeast Asia":   ["MM", "TH", "ID", "KH"],
  "Central Asia":     ["KZ", "UZ", "TJ", "AF"],
  "Caribbean":        ["CU", "HT", "JM"],
};

function contentHash(headline: string, source: string): string {
  const raw = `${headline}::${source}`.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Convert a raw partial signal into a full Signal using rule-based classification only.
// No Claude API call — instant and free.
function normalizeSignal(raw: Partial<Signal>): Signal | null {
  const headline = raw.headline ?? raw.raw_text ?? "";
  if (headline.length < 15) return null;

  return {
    id: raw.id ?? crypto.randomUUID(),
    org_id: null as unknown as string, // null = global signal, visible to all
    headline: headline.slice(0, 200),
    summary: raw.summary ?? "",
    source: raw.source ?? "unknown",
    source_url: raw.source_url ?? "",
    published_at: raw.published_at ?? new Date().toISOString(),
    ingested_at: new Date().toISOString(),
    severity: raw.severity ?? "INFO",
    domain: raw.domain ?? "Political",
    regions: raw.regions ?? [],
    countries: raw.countries ?? [],
    asset_classes: raw.asset_classes ?? [],
    entities: raw.entities ?? [],
    sentiment_score: raw.sentiment_score ?? 0,
    relevance_score: raw.relevance_score ?? 0.5,
    raw_text: raw.raw_text ?? headline,
  };
}

export async function runBootstrap(force = false): Promise<{
  signalsIngested: number;
  regionsScored: number;
  skipped: boolean;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Skip if we ingested signals in the last 14 minutes (cron runs every 15)
  if (!force) {
    const fourteenMinutesAgo = new Date(Date.now() - 14 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("signals")
      .select("id", { count: "exact", head: true })
      .gte("ingested_at", fourteenMinutesAgo);

    if ((count ?? 0) > 5) {
      return { signalsIngested: 0, regionsScored: 0, skipped: true };
    }
  }

  console.log("[Ingest] Fetching signals from GDELT + RSS...");

  // GDELT monitors 65,000+ sources globally — no hardcoded sources needed
  const gdeltRaw = await fetchAllGdeltSignals().catch(() => []);
  const rawSignals: Partial<Signal>[] = gdeltRaw;

  console.log(`[Ingest] ${rawSignals.length} raw signals fetched`);

  // Rule-based normalization — no API calls
  const normalized: Signal[] = rawSignals
    .map(normalizeSignal)
    .filter((s): s is Signal => s !== null)
    // Only keep signals with a known region
    .filter((s) => s.regions.length > 0 || s.severity === "CRITICAL" || s.severity === "HIGH");

  console.log(`[Ingest] ${normalized.length} signals after filtering`);

  if (normalized.length > 0) {
    const rows = normalized.map((s) => ({
      ...s,
      content_hash: contentHash(s.headline, s.source),
      embedding: null,
    }));

    // Batch upsert in chunks of 100
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("signals")
        .upsert(chunk, { onConflict: "content_hash", ignoreDuplicates: true });
      if (error) console.error("[Ingest] Upsert error:", error.message);
    }
  }

  // Pull all recent signals from DB for scoring (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: allStoredSignals } = await supabase
    .from("signals")
    .select("*")
    .gte("published_at", sevenDaysAgo)
    .order("published_at", { ascending: false })
    .limit(2000);

  const allSignals: Signal[] = (allStoredSignals ?? []) as Signal[];

  // Discover regions dynamically from signal data — no hardcoded list
  const regionSet = new Set<string>();
  for (const s of allSignals) {
    for (const r of s.regions) regionSet.add(r);
  }
  const regions = [...regionSet];

  console.log(`[Score] Scoring ${regions.length} regions from live signal data`);

  const riskScores: RiskScore[] = [];
  const oneDayAgo = Date.now() - 24 * 3600 * 1000;

  for (const region of regions) {
    const regionSignals = allSignals.filter((s) =>
      s.regions.some((r) =>
        r.toLowerCase() === region.toLowerCase()
      )
    );
    if (regionSignals.length === 0) continue;

    const { score, composite_breakdown } = calculateRiskScore(region, regionSignals, 0);
    const { trend, delta } = determineTrend(score, []);

    // Only accept valid 2-letter ISO codes (filter out full country names from GDELT sourcecountry)
    const signalCodes = [...new Set(
      regionSignals.flatMap((s) => s.countries ?? [])
        .filter((c) => /^[A-Z]{2}$/.test(c))
    )].slice(0, 10);
    // Fall back to region-default codes so map markers always have coordinates
    const countryCodes = signalCodes.length > 0 ? signalCodes : (REGION_DEFAULT_CODES[region] ?? []);

    riskScores.push({
      id: crypto.randomUUID(),
      region,
      country_codes: countryCodes,
      score,
      trend,
      trend_delta: delta,
      signals_today: regionSignals.filter(
        (s) => new Date(s.published_at).getTime() > oneDayAgo
      ).length,
      composite_breakdown,
      calculated_at: new Date().toISOString(),
      top_signals: regionSignals.slice(0, 3), // in-memory only, not persisted
    });
  }

  if (riskScores.length > 0) {
    const { error } = await supabase
      .from("risk_scores")
      .upsert(
        riskScores.map(({ top_signals: _ignored, ...rs }) => rs),
        { onConflict: "region" }
      );
    if (error) console.error("[Score] Upsert error:", error.message);
  }

  console.log(`[Ingest] Done: ${normalized.length} signals, ${riskScores.length} regions scored`);

  const regionNames = riskScores.map((r) => r.region);
  const dbSignalCount = allSignals.length;
  const signalsWithRegions = allSignals.filter((s) => s.regions && s.regions.length > 0).length;

  return {
    signalsIngested: normalized.length,
    regionsScored: riskScores.length,
    skipped: false,
    debug: { dbSignalCount, signalsWithRegions, regionNames },
  };
}
