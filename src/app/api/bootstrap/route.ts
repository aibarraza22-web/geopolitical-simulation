import { NextResponse } from "next/server";
import { runBootstrap } from "@/scripts/bootstrap";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await runBootstrap(true); // force=true, always re-ingest
    return NextResponse.json({
      data: result,
      message: `Ingested ${result.signalsIngested} signals across ${result.regionsScored} regions.`,
      error: null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Bootstrap failed";
    return NextResponse.json({ data: null, error: msg }, { status: 500 });
  }
}
