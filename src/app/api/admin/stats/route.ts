import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/stats
export async function GET() {
  try {
    const supabase = await createServiceClient();

    // Run all count queries in parallel
    const [usersResult, signalsResult, scenariosResult, lastIngestResult] =
      await Promise.allSettled([
        supabase.from("users").select("id", { count: "exact", head: true }),
        supabase.from("signals").select("id", { count: "exact", head: true }),
        supabase
          .from("scenarios")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("signals")
          .select("ingested_at")
          .order("ingested_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const userCount =
      usersResult.status === "fulfilled" ? (usersResult.value.count ?? 0) : 0;
    const signalCount =
      signalsResult.status === "fulfilled"
        ? (signalsResult.value.count ?? 0)
        : 0;
    const scenarioCount =
      scenariosResult.status === "fulfilled"
        ? (scenariosResult.value.count ?? 0)
        : 0;
    const lastIngestAt =
      lastIngestResult.status === "fulfilled" && lastIngestResult.value.data
        ? (lastIngestResult.value.data as { ingested_at: string }).ingested_at
        : null;

    return NextResponse.json({
      data: {
        user_count: userCount,
        signal_count: signalCount,
        scenario_count: scenarioCount,
        last_ingest_at: lastIngestAt,
      },
      error: null,
    });
  } catch (err) {
    console.error("[API] admin/stats error:", err);
    return NextResponse.json(
      { data: null, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
