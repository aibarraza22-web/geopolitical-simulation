import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HoldingSchema = z.object({
  name: z.string().min(1).max(200),
  ticker: z.string().max(20).nullable().optional(),
  asset_class: z.string().min(1).max(100),
  region_exposure: z.record(z.string(), z.number().min(0).max(1)).default({}),
  current_value_usd: z.number().positive(),
  risk_score: z.number().min(0).max(100).default(0),
  var_95: z.number().min(0).default(0),
  exposure_breakdown: z
    .object({
      military: z.number().min(0).max(100).default(0),
      financial: z.number().min(0).max(100).default(0),
      political: z.number().min(0).max(100).default(0),
      humanitarian: z.number().min(0).max(100).default(0),
      trade: z.number().min(0).max(100).default(0),
      energy: z.number().min(0).max(100).default(0),
    })
    .default({}),
});

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// GET /api/portfolio/holdings
export async function GET() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      // RLS enforces org_id = auth.uid() — no need for explicit eq filter
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], error: null });
  } catch (err) {
    console.error("[API] portfolio/holdings GET error:", err);
    return NextResponse.json({ data: null, error: "Server error" }, { status: 500 });
  }
}

// POST /api/portfolio/holdings
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const parsed = HoldingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.message }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("portfolio_holdings")
      .insert([
        {
          id: crypto.randomUUID(),
          org_id: user.id, // auth.uid() — matched by the RLS WITH CHECK policy
          ...parsed.data,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err) {
    console.error("[API] portfolio/holdings POST error:", err);
    return NextResponse.json({ data: null, error: "Server error" }, { status: 500 });
  }
}

// DELETE /api/portfolio/holdings?id=...
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ data: null, error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("portfolio_holdings")
      .delete()
      .eq("id", id);
    // RLS enforces org_id = auth.uid() so users can only delete their own rows

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: { deleted: id }, error: null });
  } catch (err) {
    console.error("[API] portfolio/holdings DELETE error:", err);
    return NextResponse.json({ data: null, error: "Server error" }, { status: 500 });
  }
}
