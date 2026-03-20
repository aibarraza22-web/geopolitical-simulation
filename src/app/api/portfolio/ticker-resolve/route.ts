/**
 * Resolves a ticker symbol to company info + geopolitical risk data.
 * Uses Yahoo Finance for company profile, then maps country → risk region → live score.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Map company domicile countries (Yahoo Finance strings) to our risk regions.
// Only countries where geopolitical risk is materially elevated.
const COUNTRY_TO_REGION: Record<string, string> = {
  // Middle East / Iran-Israel
  "Israel": "Iran-Israel",
  "Iran": "Iran-Israel",
  "Lebanon": "Middle East",
  "Iraq": "Middle East",
  "Syria": "Middle East",
  "Saudi Arabia": "Middle East",
  "Yemen": "Middle East",
  "Jordan": "Middle East",
  "Qatar": "Middle East",
  "United Arab Emirates": "Middle East",
  "Kuwait": "Middle East",
  "Bahrain": "Middle East",
  "Oman": "Middle East",
  // Ukraine / Russia
  "Ukraine": "Ukraine-Russia",
  "Russia": "Ukraine-Russia",
  "Belarus": "Ukraine-Russia",
  // East Asia
  "Taiwan": "Taiwan Strait",
  "China": "Taiwan Strait",
  "Hong Kong": "Taiwan Strait",
  "North Korea": "Korean Peninsula",
  "South Korea": "Korean Peninsula",
  // Southeast Asia
  "Philippines": "South China Sea",
  "Vietnam": "South China Sea",
  "Malaysia": "South China Sea",
  "Indonesia": "Southeast Asia",
  "Myanmar": "Southeast Asia",
  "Thailand": "Southeast Asia",
  "Cambodia": "Southeast Asia",
  // South Asia
  "India": "South Asia",
  "Pakistan": "South Asia",
  "Afghanistan": "South Asia",
  "Bangladesh": "South Asia",
  "Sri Lanka": "South Asia",
  // Africa
  "Nigeria": "West Africa",
  "Ghana": "West Africa",
  "Senegal": "West Africa",
  "Mali": "Sahel Region",
  "Niger": "Sahel Region",
  "Burkina Faso": "Sahel Region",
  "Chad": "Sahel Region",
  "Somalia": "East Africa",
  "Ethiopia": "East Africa",
  "Sudan": "East Africa",
  "Kenya": "East Africa",
  "Congo": "Central Africa",
  "Democratic Republic of Congo": "Central Africa",
  "Cameroon": "Central Africa",
  "Libya": "North Africa",
  "Tunisia": "North Africa",
  "Algeria": "North Africa",
  "Morocco": "North Africa",
  // Latin America
  "Venezuela": "South America",
  "Colombia": "South America",
  "Ecuador": "South America",
  "Bolivia": "South America",
  "Mexico": "Latin America",
  "Guatemala": "Latin America",
  "Honduras": "Latin America",
  "Haiti": "Caribbean",
  "Cuba": "Caribbean",
  // Eastern Europe
  "Serbia": "Eastern Europe",
  "Kosovo": "Eastern Europe",
  "Georgia": "Eastern Europe",
  "Armenia": "Eastern Europe",
  "Azerbaijan": "Eastern Europe",
  // Central Asia
  "Kazakhstan": "Central Asia",
  "Uzbekistan": "Central Asia",
  "Tajikistan": "Central Asia",
};

interface YahooAssetProfile {
  country?: string;
  sector?: string;
  industry?: string;
}

interface YahooPrice {
  longName?: string;
  shortName?: string;
  regularMarketPrice?: { raw?: number };
  currency?: string;
}

interface YahooQuoteSummaryResult {
  assetProfile?: YahooAssetProfile;
  price?: YahooPrice;
}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: YahooQuoteSummaryResult[];
    error?: unknown;
  };
}

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "Missing ticker" }, { status: 400 });
  }

  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=assetProfile,price`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AXIOM/1.0)" },
      signal: AbortSignal.timeout(6000),
    });

    let companyName = ticker;
    let country = "";
    let sector = "";

    if (res.ok) {
      const json = (await res.json()) as YahooQuoteSummaryResponse;
      const result = json.quoteSummary?.result?.[0];
      const profile = result?.assetProfile;
      const price = result?.price;

      companyName = price?.longName || price?.shortName || ticker;
      country = profile?.country ?? "";
      sector = profile?.sector ?? "";
    }

    // Map company country to our risk region
    const region = COUNTRY_TO_REGION[country] ?? null;

    // Fetch live risk score for that region from Supabase
    let riskScore = 0;
    let exposureBreakdown = {
      military: 0, financial: 0, political: 0,
      humanitarian: 0, trade: 0, energy: 0,
    };
    let regionExposure: Record<string, number> = {};

    if (region) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("risk_scores")
        .select("score, composite_breakdown")
        .eq("region", region)
        .order("calculated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        riskScore = (data as { score: number; composite_breakdown: typeof exposureBreakdown }).score;
        exposureBreakdown = (data as { score: number; composite_breakdown: typeof exposureBreakdown }).composite_breakdown ?? exposureBreakdown;
        regionExposure = { [region]: 1.0 };
      }
    }

    // VaR 95% (1-day) = simplified: value × (risk/100) × 0.12
    // Caller computes actual VaR once value is known; we return the risk components
    return NextResponse.json({
      data: {
        name: companyName,
        ticker,
        country,
        sector,
        region,
        risk_score: riskScore,
        exposure_breakdown: exposureBreakdown,
        region_exposure: regionExposure,
      },
    });
  } catch (err) {
    console.error("[API] ticker-resolve error:", err);
    return NextResponse.json({ error: "Failed to resolve ticker" }, { status: 500 });
  }
}
