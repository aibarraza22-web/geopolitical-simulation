import type { Signal } from "@/types";

interface GdeltArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
  status?: string;
}

// GDELT monitors 65,000+ news sources globally across 100+ languages.
// We query by TOPIC, not by region — regions emerge from what GDELT finds.
// GDELT rate limit: 1 request per 5 seconds — we use 5 queries at 6s intervals (30s total).
const BROAD_QUERIES: { query: string; maxRecords: number }[] = [
  { query: "military attack airstrike strike bomb killed war troops", maxRecords: 250 },
  { query: "nuclear missile ballistic coup invasion conflict crisis", maxRecords: 250 },
  { query: "sanctions embargo ceasefire hostage protest riot uprising", maxRecords: 200 },
  { query: "naval blockade territorial dispute escalation offensive", maxRecords: 200 },
  { query: "casualties explosion massacre civilian displaced famine", maxRecords: 200 },
];

// Geographic region mapping from country names.
// This is stable geography — it doesn't go stale.
const COUNTRY_TO_REGION: Record<string, string> = {
  // Middle East / Iran-Israel
  "Iran": "Iran-Israel", "Israel": "Iran-Israel",
  "Gaza": "Middle East", "Palestine": "Middle East",
  "Lebanon": "Middle East", "Hezbollah": "Middle East",
  "Iraq": "Middle East", "Syria": "Middle East",
  "Saudi Arabia": "Middle East", "Yemen": "Middle East",
  "Jordan": "Middle East", "Egypt": "Middle East",
  "Qatar": "Middle East", "UAE": "Middle East",
  "Bahrain": "Middle East", "Kuwait": "Middle East",
  "Oman": "Middle East", "Turkey": "Middle East",
  // Ukraine/Russia
  "Ukraine": "Ukraine-Russia", "Russia": "Ukraine-Russia",
  "Belarus": "Ukraine-Russia", "Moldova": "Ukraine-Russia",
  // East Asia
  "Taiwan": "Taiwan Strait", "China": "Taiwan Strait",
  "North Korea": "Korean Peninsula", "South Korea": "Korean Peninsula",
  // Southeast Asia / South China Sea
  "Philippines": "South China Sea", "Vietnam": "South China Sea",
  "Malaysia": "South China Sea", "Brunei": "South China Sea",
  "Indonesia": "Southeast Asia", "Myanmar": "Southeast Asia",
  "Thailand": "Southeast Asia", "Cambodia": "Southeast Asia",
  "Laos": "Southeast Asia",
  // South Asia
  "India": "South Asia", "Pakistan": "South Asia",
  "Afghanistan": "South Asia", "Bangladesh": "South Asia",
  "Sri Lanka": "South Asia", "Nepal": "South Asia",
  // Sahel / West Africa
  "Mali": "Sahel Region", "Niger": "Sahel Region",
  "Burkina Faso": "Sahel Region", "Chad": "Sahel Region",
  "Mauritania": "Sahel Region", "Guinea": "Sahel Region",
  "Senegal": "West Africa", "Nigeria": "West Africa",
  "Ghana": "West Africa", "Ivory Coast": "West Africa",
  // East / Central Africa
  "Somalia": "East Africa", "Sudan": "East Africa",
  "Ethiopia": "East Africa", "Kenya": "East Africa",
  "Uganda": "East Africa", "Tanzania": "East Africa",
  "DRC": "Central Africa", "Congo": "Central Africa",
  "Cameroon": "Central Africa", "CAR": "Central Africa",
  // North Africa
  "Libya": "North Africa", "Tunisia": "North Africa",
  "Algeria": "North Africa", "Morocco": "North Africa",
  // Eastern Europe
  "Poland": "Eastern Europe", "Hungary": "Eastern Europe",
  "Romania": "Eastern Europe", "Serbia": "Eastern Europe",
  "Kosovo": "Eastern Europe", "Bosnia": "Eastern Europe",
  "Albania": "Eastern Europe", "Macedonia": "Eastern Europe",
  "Georgia": "Eastern Europe", "Armenia": "Eastern Europe",
  "Azerbaijan": "Eastern Europe",
  // Central Asia
  "Kazakhstan": "Central Asia", "Uzbekistan": "Central Asia",
  "Tajikistan": "Central Asia", "Kyrgyzstan": "Central Asia",
  "Turkmenistan": "Central Asia",
  // Latin America
  "Venezuela": "South America", "Colombia": "South America",
  "Ecuador": "South America", "Peru": "South America",
  "Bolivia": "South America", "Brazil": "South America",
  "Argentina": "South America", "Chile": "South America",
  "Mexico": "Latin America", "Guatemala": "Latin America",
  "Honduras": "Latin America", "El Salvador": "Latin America",
  "Nicaragua": "Latin America", "Haiti": "Latin America",
  "Cuba": "Caribbean",
};

// Infer regions from article text + sourcecountry.
// Checks article text first (most specific), falls back to source country.
export function inferRegionsFromArticle(title: string, sourcecountry: string): string[] {
  const text = `${title} ${sourcecountry}`.toLowerCase();
  const regions = new Set<string>();

  // Entity-based text matching
  const entityMap: [RegExp, string][] = [
    [/\biran\b|irgc|khamenei|tehran|fordow|rouhani|raisi/i, "Iran-Israel"],
    [/\bisrael\b|idf|netanyahu|tel aviv|mossad|gaza|hamas|hezbollah/i, "Iran-Israel"],
    [/\btaiwan\b|strait|tsmc|cross.?strait|pla navy/i, "Taiwan Strait"],
    [/\bukraine\b|kyiv|zelensky|donbas|kherson|zaporizhzhia|kharkiv/i, "Ukraine-Russia"],
    [/\brussia\b|moscow|putin|kremlin|wagner|siberia|kaliningrad/i, "Ukraine-Russia"],
    [/\bnorth korea\b|kim jong|pyongyang|icbm|juche|dprk/i, "Korean Peninsula"],
    [/\bsouth korea\b|seoul|rok military/i, "Korean Peninsula"],
    [/south china sea|spratlys|paracel|manila|philippines navy/i, "South China Sea"],
    [/\bsahel\b|mali\b|niger\b|burkina|bamako|ouagadougou|niamey|wagner africa/i, "Sahel Region"],
    [/\byemen\b|houthi|sanaa|aden/i, "Middle East"],
    [/\biraq\b|baghdad|fallujah|mosul/i, "Middle East"],
    [/\bsyria\b|damascus|aleppo|idlib/i, "Middle East"],
    [/\blebanon\b|beirut/i, "Middle East"],
    [/\bsaudi arabia\b|riyadh|mbs|aramco/i, "Middle East"],
    [/\bsomalia\b|mogadishu|al.?shabaab/i, "East Africa"],
    [/\bethiopia\b|tigray|addis ababa/i, "East Africa"],
    [/\bsudan\b|khartoum|darfur|rsf/i, "East Africa"],
    [/\bdrc\b|congo|kinshasa|m23/i, "Central Africa"],
    [/\bpakistan\b|islamabad|karachi|isi/i, "South Asia"],
    [/\bindia\b|modi|new delhi|kashmir/i, "South Asia"],
    [/\bafghanistan\b|kabul|taliban/i, "South Asia"],
    [/\bmyanmar\b|burma|tatmadaw|naypyidaw/i, "Southeast Asia"],
    [/\bvenezuela\b|maduro|caracas|pdvsa/i, "South America"],
    [/\bcolumbia\b|colombia|farc|medellin/i, "South America"],
    [/\bmexico\b|cartel|sinaloa|jalisco/i, "Latin America"],
    [/\bgeorgia\b|tbilisi|south ossetia|abkhazia/i, "Eastern Europe"],
    [/\bserbia\b|kosovo|belgrade/i, "Eastern Europe"],
    [/\bazerbaijan\b|armenia|nagorno|baku/i, "Eastern Europe"],
    [/\blibya\b|tripoli|benghazi|haftar/i, "North Africa"],
  ];

  for (const [regex, region] of entityMap) {
    if (regex.test(text)) regions.add(region);
  }

  // Fallback: map sourcecountry directly to a region
  if (regions.size === 0 && sourcecountry) {
    for (const [country, region] of Object.entries(COUNTRY_TO_REGION)) {
      if (sourcecountry.toLowerCase().includes(country.toLowerCase())) {
        regions.add(region);
        break;
      }
    }
  }

  return [...regions];
}

const GDELT_BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

async function fetchGDELTBatch(
  query: string,
  maxRecords: number
): Promise<Partial<Signal>[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    maxrecords: String(maxRecords),
    format: "json",
    timespan: "48h",
    sort: "DateDesc",
  });

  try {
    const response = await fetch(`${GDELT_BASE}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      console.warn(`[GDELT] HTTP ${response.status} for query "${query.slice(0, 40)}"`);
      return [];
    }

    const data = (await response.json()) as GdeltResponse;
    if (!data.articles || data.articles.length === 0) return [];

    return data.articles.map((article) => normalizeGdeltArticle(article));
  } catch (err) {
    console.warn(`[GDELT] Fetch error:`, (err as Error).message);
    return [];
  }
}

function normalizeGdeltArticle(article: GdeltArticle): Partial<Signal> {
  let publishedAt: string;
  try {
    const ds = article.seendate;
    publishedAt = new Date(
      `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}T${ds.slice(9, 11)}:${ds.slice(11, 13)}:00Z`
    ).toISOString();
  } catch {
    publishedAt = new Date().toISOString();
  }

  const title = article.title ?? "";
  const titleLower = title.toLowerCase();
  const regions = inferRegionsFromArticle(title, article.sourcecountry ?? "");

  let domain: Signal["domain"] = "Political";
  if (/military|troops|missile|bomb|drone|war|attack|combat|strike|navy|army|airstrike|irgc|hamas|hezbollah|idf|rocket|ballistic|explosion/.test(titleLower)) {
    domain = "Military";
  } else if (/oil|gas|energy|pipeline|uranium|nuclear plant|fuel|opec|lng/.test(titleLower)) {
    domain = "Energy";
  } else if (/sanction|economy|market|bank|debt|currency|inflation|recession|finance/.test(titleLower)) {
    domain = "Financial";
  } else if (/trade|export|import|tariff|supply chain|semiconductor|chip/.test(titleLower)) {
    domain = "Trade";
  } else if (/refugee|humanitarian|famine|aid|civilians|massacre|genocide/.test(titleLower)) {
    domain = "Humanitarian";
  }

  let severity: Signal["severity"] = "INFO";
  if (/nuclear|invasion|world war|airstrike|killed|casualties|explosion|critical|emergency/.test(titleLower)) {
    severity = "CRITICAL";
  } else if (/escalat|conflict|strike|attack|missile|troops|sanctions|coup|threat|intercept|launch/.test(titleLower)) {
    severity = "HIGH";
  } else if (/tension|concern|warning|protest|dispute|standoff|deploy/.test(titleLower)) {
    severity = "MEDIUM";
  } else if (/talks|diplomatic|meeting|summit|agreement|ceasefire/.test(titleLower)) {
    severity = "LOW";
  }

  // Sentiment: negative for hostile events, neutral for diplomacy
  const sentimentScore =
    severity === "CRITICAL" ? -0.8 :
    severity === "HIGH" ? -0.5 :
    severity === "MEDIUM" ? -0.2 :
    severity === "LOW" ? 0.1 : 0;

  return {
    id: crypto.randomUUID(),
    headline: title.slice(0, 200),
    summary: "",
    source: article.domain ?? "gdelt",
    source_url: article.url ?? "",
    published_at: publishedAt,
    ingested_at: new Date().toISOString(),
    severity,
    domain,
    regions,
    countries: [article.sourcecountry ?? ""].filter(Boolean),
    asset_classes: [],
    entities: [],
    sentiment_score: sentimentScore,
    relevance_score: regions.length > 0 ? 0.75 : 0.4,
    raw_text: title,
  };
}

// RSS feeds spanning all major conflict zones globally.
// Each region has 2-3 dedicated sources so no conflict zone is systematically under-covered.
const FALLBACK_RSS_FEEDS = [
  // Global wire services
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",                              source: "BBC World" },
  { url: "https://feeds.reuters.com/reuters/worldNews",                               source: "Reuters" },

  // Middle East / Iran-Israel (3 dedicated sources)
  { url: "https://www.aljazeera.com/xml/rss/all.xml",                                source: "Al Jazeera" },
  { url: "https://www.timesofisrael.com/feed/",                                       source: "Times of Israel" },
  { url: "https://www.middleeastmonitor.com/feed/",                                   source: "Middle East Monitor" },

  // Ukraine / Russia / Eastern Europe (3 dedicated sources)
  { url: "https://www.kyivindependent.com/feed/",                                     source: "Kyiv Independent" },
  { url: "https://www.themoscowtimes.com/rss/news",                                   source: "Moscow Times" },
  { url: "https://www.rferl.org/api/zymqivue_os",                                     source: "Radio Free Europe" },

  // South Asia — India/Pakistan (2 dedicated sources)
  { url: "https://www.dawn.com/feeds/home",                                            source: "Dawn (Pakistan)" },
  { url: "https://www.thehindu.com/news/national/feeder/default.rss",                 source: "The Hindu" },

  // Asia / Indo-Pacific / Taiwan (2 sources)
  { url: "https://thediplomat.com/feed/",                                              source: "The Diplomat" },
  { url: "https://asiatimes.com/feed/",                                                source: "Asia Times" },

  // Africa — Sahel, East, Central (2 sources)
  { url: "https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf",            source: "AllAfrica" },
  { url: "https://www.theafricareport.com/feed/",                                      source: "Africa Report" },

  // Latin America / South America (2 sources)
  { url: "https://insightcrime.org/feed/",                                             source: "InSight Crime" },
  { url: "https://en.mercopress.com/rss.php",                                          source: "MercoPress" },
];

async function fetchRssFallback(): Promise<Partial<Signal>[]> {
  const results: Partial<Signal>[] = [];

  for (const { url, source } of FALLBACK_RSS_FEEDS) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "AXIOM-Intelligence/1.0", Accept: "application/rss+xml, text/xml" },
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      for (const match of xml.matchAll(itemRegex)) {
        const block = match[1];
        const getTag = (tag: string) => {
          const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
          return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() : "";
        };
        const title = getTag("title");
        const link = getTag("link") || getTag("guid");
        const description = getTag("description");
        if (!title || !link) continue;

        const fullText = `${title} ${description}`;
        const regions = inferRegionsFromArticle(fullText, "");

        let severity: Signal["severity"] = "INFO";
        const fl = fullText.toLowerCase();
        if (/nuclear|invasion|airstrike|killed|casualties|explosion|critical/.test(fl)) severity = "CRITICAL";
        else if (/escalat|conflict|strike|attack|missile|coup|crisis|intercept/.test(fl)) severity = "HIGH";
        else if (/tension|warning|protest|standoff|deploy|threat/.test(fl)) severity = "MEDIUM";

        let domain: Signal["domain"] = "Political";
        if (/military|troops|bomb|drone|war|attack|strike|navy|irgc|hamas|idf/.test(fl)) domain = "Military";
        else if (/sanction|economy|market|bank|currency|inflation/.test(fl)) domain = "Financial";
        else if (/oil|gas|energy|pipeline|nuclear plant/.test(fl)) domain = "Energy";
        else if (/refugee|humanitarian|famine|civilians|massacre/.test(fl)) domain = "Humanitarian";

        results.push({
          id: crypto.randomUUID(),
          headline: title.slice(0, 200),
          summary: description.slice(0, 500),
          source,
          source_url: link,
          published_at: new Date().toISOString(),
          ingested_at: new Date().toISOString(),
          severity,
          domain,
          regions,
          countries: [],
          asset_classes: [],
          entities: [],
          sentiment_score: severity === "CRITICAL" ? -0.8 : severity === "HIGH" ? -0.5 : -0.2,
          relevance_score: regions.length > 0 ? 0.75 : 0.4,
          raw_text: fullText,
        });
      }
    } catch {
      // feed failed, continue
    }
  }

  return results;
}

export async function fetchAllGdeltSignals(): Promise<Partial<Signal>[]> {
  const results: Partial<Signal>[] = [];

  // RSS runs first — always available, no rate limits, real-time news
  const rss = await fetchRssFallback();
  results.push(...rss);
  console.log(`[Ingest] RSS: ${rss.length} signals`);

  // GDELT runs as an enhancement — adds global coverage if not rate-limited
  // Sequential requests with 6s delay to respect GDELT's 1 req/5s limit
  let gdeltCount = 0;
  for (const { query, maxRecords } of BROAD_QUERIES) {
    const batch = await fetchGDELTBatch(query, maxRecords);
    gdeltCount += batch.length;
    results.push(...batch);
    if (batch.length > 0) {
      await new Promise((r) => setTimeout(r, 6000));
    }
  }
  if (gdeltCount > 0) {
    console.log(`[Ingest] GDELT: ${gdeltCount} additional signals`);
  } else {
    console.log("[Ingest] GDELT: rate-limited, skipped");
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return results.filter((s) => {
    if (!s.source_url || seen.has(s.source_url)) return false;
    seen.add(s.source_url);
    return true;
  });
}
