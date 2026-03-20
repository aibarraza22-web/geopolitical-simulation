import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Prediction } from "@/types";

// =============================================================================
// GET /api/predictions
// Returns all current predictions ordered by probability DESC
// =============================================================================
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .order("probability", { ascending: false });

    if (error) {
      console.error("[Predictions] Fetch error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const predictions: Prediction[] = (data ?? []) as Prediction[];

    return NextResponse.json({ predictions });
  } catch (error) {
    console.error("[Predictions] Unexpected error:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
