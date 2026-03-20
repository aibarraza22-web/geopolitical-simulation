import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const region = searchParams.get("region");

  try {
    const supabase = await createClient();

    // Use DISTINCT ON equivalent: fetch most recent score per region
    // Supabase doesn't support DISTINCT ON via the JS client, so we use
    // order + limit with a grouped approach using RPC or a view.
    // As a pragmatic fallback: fetch all and deduplicate in JS.
    let query = supabase
      .from("risk_scores")
      .select("*")
      .order("calculated_at", { ascending: false });

    if (region) {
      query = query.eq("region", region);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API] risk-scores Supabase error:", error.message);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Deduplicate: keep only the most recent score per region
    const seen = new Set<string>();
    const latest = (data ?? []).filter((row: { region: string }) => {
      if (seen.has(row.region)) return false;
      seen.add(row.region);
      return true;
    });

    if (latest.length === 0) {
      // Table is empty — signal client to trigger bootstrap
      return NextResponse.json(
        { data: [], initializing: true },
        { headers: { "X-Initializing": "true" } }
      );
    }

    return NextResponse.json({ data: latest, error: null });
  } catch (error) {
    console.error("[API] risk-scores error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch risk scores" },
      { status: 500 }
    );
  }
}
