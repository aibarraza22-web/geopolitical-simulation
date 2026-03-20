import type { Signal } from "@/types";

// Diverse global sources — not just Western wire services.
// Includes Middle Eastern, Asian, and African outlets so coverage
// reflects actual event intensity, not Western editorial priorities.
const RSS_FEEDS = [
  // Global wire services
  { url: "https://feeds.reuters.com/reuters/worldNews",        source: "Reuters" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",       source: "BBC World" },
  // Middle East focused
  { url: "https://www.aljazeera.com/xml/rss/all.xml",         source: "Al Jazeera" },
  { url: "https://www.middleeasteye.net/rss",                  source: "Middle East Eye" },
  { url: "https://www.timesofisrael.com/feed/",               source: "Times of Israel" },
  { url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx",  source: "Jerusalem Post" },
  // Asia / Indo-Pacific
  { url: "https://www.scmp.com/rss/91/feed",                  source: "SCMP" },
  { url: "https://feeds.feedburner.com/ndtvnews-world-news",  source: "NDTV World" },
  // Africa / Sahel
  { url: "https://allafrica.com/tools/headlines/rdf/africa/headlines.rdf", source: "AllAfrica" },
  // Eastern Europe
  { url: "https://www.kyivindependent.com/feed/",             source: "Kyiv Independent" },
];

interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  for (const match of xml.matchAll(itemRegex)) {
    const itemXml = match[1];
    const getTag = (tag: string): string => {
      const tagRegex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
      const m = itemXml.match(tagRegex);
      if (!m) return "";
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
    };
    const title = getTag("title");
    const link = getTag("link") || getTag("guid");
    if (title && link) {
      items.push({ title, description: getTag("description"), link, pubDate: getTag("pubDate") });
    }
  }
  return items;
}

function inferRegions(text: string): string[] {
  const t = text.toLowerCase();
  const regions: string[] = [];
  if (/taiwan|strait|pla|tsmc|cross.?strait/.test(t))                                    regions.push("Taiwan Strait");
  if (/ukraine|russia|moscow|kyiv|zelenskyy|donbas|zaporizhzhia/.test(t))                regions.push("Ukraine-Russia");
  if (/iran|israel|netanyahu|irgc|hezbollah|tehran|persian gulf|khamenei|idf/.test(t))   regions.push("Iran-Israel");
  if (/middle east|saudi|yemen|iraq|syria|houthi|riyadh|jordan|lebanon|gaza/.test(t))    regions.push("Middle East");
  if (/south china sea|philippines|vietnam|spratlys|paracel|manila|spratly/.test(t))     regions.push("South China Sea");
  if (/sahel|mali|niger|burkina|west africa|bamako|ouagadougou|niamey|wagner/.test(t))   regions.push("Sahel Region");
  if (/korea|pyongyang|kim jong|north korea|dmz|icbm|seoul/.test(t))                     regions.push("Korean Peninsula");
  if (/venezuela|maduro|pdvsa|caracas|guaido/.test(t))                                   regions.push("Venezuela");
  return regions;
}

function normalizeFeedItem(item: RssItem, sourceName: string): Partial<Signal> {
  let publishedAt: string;
  try { publishedAt = new Date(item.pubDate).toISOString(); }
  catch { publishedAt = new Date().toISOString(); }

  const fullText = `${item.title} ${item.description}`.toLowerCase();
  const regions = inferRegions(fullText);

  let domain: Signal["domain"] = "Political";
  if (/military|troops|missile|bomb|drone|war|attack|combat|strike|navy|army|airstrike|irgc|hamas|hezbollah|idf|rocket|ballistic/.test(fullText)) domain = "Military";
  else if (/oil|gas|energy|pipeline|uranium|nuclear power|electricity|opec|lng/.test(fullText)) domain = "Energy";
  else if (/sanction|economy|market|bank|finance|gdp|inflation|recession|currency|bonds/.test(fullText)) domain = "Financial";
  else if (/trade|export|import|tariff|supply chain|semiconductor|chip|port/.test(fullText)) domain = "Trade";
  else if (/refugee|humanitarian|famine|aid|civilian|relief|displaced|casualties/.test(fullText)) domain = "Humanitarian";

  let severity: Signal["severity"] = "INFO";
  if (/nuclear|invasion|world war|catastrophic|critical|emergency|killed|casualties|airstrike|explosion/.test(fullText)) severity = "CRITICAL";
  else if (/escalat|conflict|strike|attack|troops|coup|sanctions|crisis|intercept|launch|detain/.test(fullText)) severity = "HIGH";
  else if (/tension|threat|concern|warning|protest|standoff|deploy|maneuver/.test(fullText)) severity = "MEDIUM";
  else if (/diplomatic|talks|summit|agreement|deal|ceasefire|negotiat/.test(fullText)) severity = "LOW";

  return {
    id: crypto.randomUUID(),
    headline: item.title.slice(0, 200),
    summary: item.description.slice(0, 500),
    source: sourceName,
    source_url: item.link,
    published_at: publishedAt,
    ingested_at: new Date().toISOString(),
    severity,
    domain,
    regions,
    countries: [],
    asset_classes: [],
    entities: [],
    sentiment_score: severity === "CRITICAL" ? -0.8 : severity === "HIGH" ? -0.5 : -0.2,
    relevance_score: regions.length > 0 ? 0.75 : 0.3,
    raw_text: `${item.title}\n${item.description}`,
  };
}

async function fetchRssFeed(feedUrl: string, sourceName: string): Promise<Partial<Signal>[]> {
  try {
    const response = await fetch(feedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "AXIOM-Intelligence/1.0 geopolitical-risk-monitor",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!response.ok) {
      console.warn(`[RSS] ${sourceName}: HTTP ${response.status}`);
      return [];
    }
    const xml = await response.text();
    return parseRssXml(xml).map((item) => normalizeFeedItem(item, sourceName));
  } catch (err) {
    console.warn(`[RSS] ${sourceName} failed:`, (err as Error).message);
    return [];
  }
}

export async function fetchAllRssSignals(): Promise<Partial<Signal>[]> {
  // Fetch all feeds in parallel
  const results = await Promise.allSettled(
    RSS_FEEDS.map((feed) => fetchRssFeed(feed.url, feed.source))
  );

  const signals: Partial<Signal>[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") signals.push(...result.value);
  }

  // Keep signals with known regions or high severity
  const relevant = signals.filter(
    (s) => (s.regions && s.regions.length > 0) || s.severity === "CRITICAL" || s.severity === "HIGH"
  );

  // Deduplicate by URL
  const seen = new Set<string>();
  return relevant.filter((s) => {
    if (!s.source_url || seen.has(s.source_url)) return false;
    seen.add(s.source_url);
    return true;
  });
}
