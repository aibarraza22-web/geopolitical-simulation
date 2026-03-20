/**
 * Research corpus ingestion — fetches from open-access think tank RSS feeds.
 * Runs on demand (POST /api/research/ingest).
 * Uses service role key to bypass RLS for global (org_id IS NULL) corpus inserts.
 */
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open-access think tank and policy research RSS feeds.
// These publish freely available analysis on geopolitical risk, security, and economics.
const THINK_TANK_FEEDS: { url: string; source: string; type: string }[] = [
  // Security & Strategy
  { url: "https://warontherocks.com/feed/",                                   source: "War on the Rocks",         type: "analysis" },
  { url: "https://www.csis.org/analysis.rss",                                 source: "CSIS",                     type: "report" },
  { url: "https://carnegieendowment.org/rss/solr.xml?q=*",                    source: "Carnegie Endowment",       type: "report" },
  { url: "https://www.iiss.org/en/online-analysis/rss",                       source: "IISS",                     type: "analysis" },
  { url: "https://www.stimson.org/feed/",                                      source: "Stimson Center",           type: "report" },
  { url: "https://www.armscontrol.org/rss.xml",                               source: "Arms Control Association", type: "report" },
  // Foreign Policy & International Affairs
  { url: "https://www.cfr.org/rss.xml",                                        source: "Council on Foreign Relations", type: "analysis" },
  { url: "https://www.wilsoncenter.org/rss.xml",                              source: "Wilson Center",             type: "analysis" },
  { url: "https://www.brookings.edu/research/feed/",                          source: "Brookings Institution",    type: "report" },
  { url: "https://foreignpolicy.com/category/analysis/feed/",                 source: "Foreign Policy",           type: "analysis" },
  { url: "https://www.lowyinstitute.org/the-interpreter/rss.xml",             source: "Lowy Institute",           type: "analysis" },
  // Energy & Economics
  { url: "https://www.oxfordenergy.org/feed/",                                 source: "Oxford Energy",            type: "report" },
  { url: "https://energypolicy.columbia.edu/feed/",                           source: "Columbia SIPA Energy",     type: "report" },
  // Regional Specialists
  { url: "https://www.mei.edu/rss.xml",                                        source: "Middle East Institute",    type: "analysis" },
  { url: "https://www.rusi.org/rss.xml",                                       source: "RUSI",                     type: "report" },
  { url: "https://www.chathamhouse.org/rss.xml",                              source: "Chatham House",             type: "analysis" },
  { url: "https://thediplomat.com/category/opinion/feed/",                    source: "The Diplomat Opinion",     type: "analysis" },
  { url: "https://www.crisisgroup.org/rss.xml",                               source: "International Crisis Group", type: "report" },
];

// Region detection from article text
const REGION_PATTERNS: [RegExp, string][] = [
  [/\biran\b|irgc|tehran|khamenei/i, "Iran-Israel"],
  [/\bisrael\b|idf|netanyahu|tel aviv|mossad|gaza|hamas|hezbollah/i, "Iran-Israel"],
  [/\btaiwan\b|strait|tsmc|cross.?strait|pla navy/i, "Taiwan Strait"],
  [/\bukraine\b|kyiv|zelensky|donbas|zaporizhzhia/i, "Ukraine-Russia"],
  [/\brussia\b|moscow|putin|kremlin|wagner/i, "Ukraine-Russia"],
  [/\bnorth korea\b|kim jong|pyongyang|dprk|icbm/i, "Korean Peninsula"],
  [/south china sea|spratlys|paracel|philippines navy/i, "South China Sea"],
  [/\bsahel\b|mali\b|niger\b|burkina|niamey|bamako/i, "Sahel Region"],
  [/\byemen\b|houthi|sanaa/i, "Middle East"],
  [/\biraq\b|baghdad/i, "Middle East"],
  [/\bsyria\b|damascus/i, "Middle East"],
  [/\bsaudi arabia\b|riyadh|aramco/i, "Middle East"],
  [/\bsomalia\b|mogadishu|al.?shabaab/i, "East Africa"],
  [/\bethiopia\b|tigray/i, "East Africa"],
  [/\bsudan\b|khartoum|darfur/i, "East Africa"],
  [/\bdrc\b|congo|kinshasa|m23/i, "Central Africa"],
  [/\bpakistan\b|islamabad|kashmir/i, "South Asia"],
  [/\bindia\b|modi|new delhi/i, "South Asia"],
  [/\bafghanistan\b|kabul|taliban/i, "South Asia"],
  [/\bvenezuela\b|maduro/i, "South America"],
  [/\bmexico\b|cartel|sinaloa/i, "Latin America"],
  [/\bgeorgia\b|tbilisi|south ossetia/i, "Eastern Europe"],
  [/\bazerbaijan\b|armenia|nagorno/i, "Eastern Europe"],
  [/\blibya\b|tripoli/i, "North Africa"],
];

const DOMAIN_PATTERNS: [RegExp, string][] = [
  [/military|troops|missile|bomb|drone|war|attack|combat|strike|navy|army|airstrike|weapon|defense/i, "Military"],
  [/nuclear|uranium|nonproliferation|arms control|icbm|ballistic/i, "Military"],
  [/oil|gas|energy|pipeline|opec|lng|fuel|petroleum/i, "Energy"],
  [/sanction|economy|market|bank|debt|currency|inflation|financial|trade|tariff|export|import/i, "Financial"],
  [/refugee|humanitarian|famine|aid|civilian|displaced|crisis/i, "Humanitarian"],
  [/political|election|coup|government|policy|diplomatic|diplomacy|relations/i, "Political"],
];

function detectRegions(text: string): string[] {
  const regions = new Set<string>();
  for (const [pattern, region] of REGION_PATTERNS) {
    if (pattern.test(text)) regions.add(region);
  }
  return [...regions];
}

function detectDomains(text: string): string[] {
  const domains = new Set<string>();
  for (const [pattern, domain] of DOMAIN_PATTERNS) {
    if (pattern.test(text)) domains.add(domain);
  }
  if (domains.size === 0) domains.add("Political"); // default
  return [...domains];
}

function contentHash(title: string, source: string): string {
  const raw = `${title}::${source}`.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

interface FeedItem {
  title: string;
  content: string;
  source_url: string;
  source: string;
  document_type: string;
  published_at: string;
  regions: string[];
  domains: string[];
}

async function fetchFeed(url: string, source: string, type: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AXIOM-Research/1.0", Accept: "application/rss+xml, text/xml, application/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const items: FeedItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

    for (const match of xml.matchAll(itemRegex)) {
      const block = match[1];
      const getTag = (tag: string) => {
        const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim() : "";
      };

      const title = getTag("title");
      const link = getTag("link") || getTag("guid");
      const description = getTag("description") || getTag("content:encoded") || getTag("summary");
      const pubDate = getTag("pubDate") || getTag("dc:date") || getTag("published");

      if (!title || title.length < 10 || !link) continue;

      const fullText = `${title} ${description}`;
      const regions = detectRegions(fullText);
      const domains = detectDomains(fullText);

      let publishedAt: string;
      try {
        publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
      } catch {
        publishedAt = new Date().toISOString();
      }

      items.push({
        title: title.slice(0, 300),
        content: description.slice(0, 2000) || title,
        source_url: link,
        source,
        document_type: type,
        published_at: publishedAt,
        regions,
        domains,
      });
    }

    return items;
  } catch {
    return [];
  }
}

export async function POST() {
  try {
    // Service role key — bypasses RLS for global corpus inserts
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all feeds in parallel
    const feedResults = await Promise.all(
      THINK_TANK_FEEDS.map(({ url, source, type }) => fetchFeed(url, source, type))
    );

    const allItems = feedResults.flat();
    console.log(`[Research Ingest] ${allItems.length} articles fetched from ${THINK_TANK_FEEDS.length} feeds`);

    if (allItems.length === 0) {
      return NextResponse.json({ ingested: 0, message: "No articles fetched" });
    }

    // Deduplicate by content hash
    const seen = new Set<string>();
    const uniqueItems = allItems.filter((item) => {
      const hash = contentHash(item.title, item.source);
      if (seen.has(hash)) return false;
      seen.add(hash);
      return true;
    });

    // Batch insert — skip existing by checking source_url
    let ingested = 0;
    const batchSize = 50;

    for (let i = 0; i < uniqueItems.length; i += batchSize) {
      const batch = uniqueItems.slice(i, i + batchSize);
      const rows = batch.map((item) => ({
        id: crypto.randomUUID(),
        org_id: null, // NULL = global, readable by all users per RLS
        title: item.title,
        content: item.content,
        source: item.source,
        source_url: item.source_url,
        document_type: item.document_type,
        domains: item.domains,
        regions: item.regions,
        published_at: item.published_at,
      }));

      // Use upsert with source_url conflict if the column has a unique index,
      // otherwise just insert and ignore duplicates via error handling
      const { error, data } = await supabase
        .from("research_corpus")
        .upsert(rows, { onConflict: "source_url", ignoreDuplicates: true })
        .select("id");

      if (error) {
        // If no unique constraint on source_url, fall back to plain insert
        const { data: insertData } = await supabase
          .from("research_corpus")
          .insert(rows)
          .select("id");
        ingested += (insertData ?? []).length;
      } else {
        ingested += (data ?? []).length;
      }
    }

    console.log(`[Research Ingest] ${ingested} new documents added to corpus`);
    return NextResponse.json({
      ingested,
      total_fetched: allItems.length,
      feeds: THINK_TANK_FEEDS.length,
    });
  } catch (err) {
    console.error("[Research Ingest] Error:", err);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
