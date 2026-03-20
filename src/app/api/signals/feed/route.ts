import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SignalSeverity, SignalDomain } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10));
  const region = searchParams.get("region");
  const signalType = searchParams.get("signal_type") as SignalDomain | null;
  const minSeverity = searchParams.get("min_severity") as SignalSeverity | null;
  const since = searchParams.get("since");

  const SEVERITY_ORDER: Record<SignalSeverity, number> = {
    CRITICAL: 5,
    HIGH: 4,
    MEDIUM: 3,
    LOW: 2,
    INFO: 1,
  };

  try {
    const supabase = await createClient();

    let query = supabase
      .from("signals")
      .select("*", { count: "exact" })
      .order("published_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (region) {
      query = query.contains("regions", [region]);
    }

    if (signalType) {
      query = query.eq("domain", signalType);
    }

    if (since) {
      query = query.gte("published_at", since);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[API] signals/feed Supabase error:", error.message);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    // Apply min_severity filter in-memory (Supabase doesn't support enum ordering natively)
    let signals = data ?? [];
    if (minSeverity && SEVERITY_ORDER[minSeverity]) {
      const minLevel = SEVERITY_ORDER[minSeverity];
      signals = signals.filter(
        (s: { severity: SignalSeverity }) => (SEVERITY_ORDER[s.severity] ?? 0) >= minLevel
      );
    }

    const total = count ?? 0;

    // If no data yet, signal to the client that ingestion is pending
    if (total === 0) {
      return NextResponse.json(
        { data: [], total: 0, page, ingesting: true },
        {
          headers: {
            "X-Ingesting": "true",
          },
        }
      );
    }

    return NextResponse.json({ data: signals, total, page });
  } catch (error) {
    console.error("[API] signals/feed error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
