import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/research/search?q=query
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json(
      { data: null, error: "Query parameter 'q' is required (min 2 chars)" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    // Text search using ILIKE on title and content
    // Semantic search (pgvector) can be added later as an upgrade
    const { data, error } = await supabase
      .from("research_corpus")
      .select("*")
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
      .order("published_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[API] research/search Supabase error:", error.message);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], query: q, error: null });
  } catch (err) {
    console.error("[API] research/search error:", err);
    return NextResponse.json({ data: null, error: "Search failed" }, { status: 500 });
  }
}
