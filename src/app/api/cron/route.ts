import { NextRequest, NextResponse } from "next/server";
import { runBootstrap } from "@/scripts/bootstrap";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// GET /api/cron — called by Vercel Cron or any scheduler
// Pass ?force=true to bypass the 5-minute throttle (used by manual refresh button)
export async function GET(request: NextRequest) {
  const force = request.nextUrl.searchParams.get("force") === "true";
  try {
    const result = await runBootstrap(force);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
