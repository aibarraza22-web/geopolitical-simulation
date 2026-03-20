import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return NextResponse.json({ data: [] });

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false&region=US&lang=en-US`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AXIOM/1.0)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return NextResponse.json({ data: [] });

    const json = await res.json() as { quotes?: Record<string, unknown>[] };
    const quotes = json.quotes ?? [];

    const results = quotes
      .filter((q) =>
        q.quoteType === "EQUITY" ||
        q.quoteType === "ETF" ||
        q.quoteType === "MUTUALFUND"
      )
      .slice(0, 8)
      .map((q) => ({
        ticker: q.symbol as string,
        name: (q.longname || q.shortname || q.symbol) as string,
        exchange: (q.exchDisp || q.exchange || "") as string,
        type: q.quoteType as string,
      }));

    return NextResponse.json({ data: results });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
