import { NextResponse } from "next/server";
import { runBootstrap } from "@/scripts/bootstrap";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// GET /api/cron — called by Vercel Cron or any scheduler every 15 minutes
// Also callable manually from the dashboard
export async function GET() {
  try {
    const result = await runBootstrap();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
