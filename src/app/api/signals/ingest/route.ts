import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAnthropicClient, buildNLPPrompt } from "@/lib/anthropic";
import { createServiceClient } from "@/lib/supabase/server";
import type { Signal } from "@/types";

export const runtime = "nodejs";

const IngestSchema = z.object({
  raw_text: z.string().min(20).max(10000),
  source: z.string().optional(),
  source_url: z.string().url().optional(),
  published_at: z.string().datetime().optional(),
  org_id: z.string().optional(),
});

function contentHash(headline: string, source: string): string {
  const raw = `${headline}::${source}`.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = IngestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.message },
        { status: 400 }
      );
    }

    const { raw_text, source, source_url, published_at, org_id } = parsed.data;

    // Run Claude NLP classification
    const anthropic = getAnthropicClient();
    const prompt = buildNLPPrompt(raw_text);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    let nlpResult: Partial<Signal>;
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      nlpResult = JSON.parse(jsonMatch[0]) as Partial<Signal>;
    } catch {
      throw new Error("Failed to parse Claude classification response");
    }

    const headline = nlpResult.headline ?? raw_text.slice(0, 120);
    const sourceName = source ?? nlpResult.source ?? "Unknown";

    const signal: Signal = {
      id: crypto.randomUUID(),
      org_id: org_id ?? "global",
      headline,
      summary: nlpResult.summary ?? "",
      source: sourceName,
      source_url: source_url ?? "",
      published_at: published_at ?? new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      severity: nlpResult.severity ?? "INFO",
      domain: nlpResult.domain ?? "Political",
      regions: nlpResult.regions ?? [],
      countries: nlpResult.countries ?? [],
      asset_classes: nlpResult.asset_classes ?? [],
      entities: nlpResult.entities ?? [],
      sentiment_score: nlpResult.sentiment_score ?? 0,
      relevance_score: nlpResult.relevance_score ?? 0.5,
      raw_text,
    };

    // Upsert into Supabase — skip duplicate via content_hash
    const supabase = await createServiceClient();

    const { error: upsertError } = await supabase
      .from("signals")
      .upsert(
        [
          {
            ...signal,
            content_hash: contentHash(headline, sourceName),
            embedding: null, // pgvector placeholder
          },
        ],
        { onConflict: "content_hash", ignoreDuplicates: true }
      );

    if (upsertError) {
      console.error("[API] signals/ingest upsert error:", upsertError.message);
      // Still return the signal even if DB insert fails (e.g., duplicate)
    }

    return NextResponse.json({ data: signal, error: null });
  } catch (error) {
    console.error("[API] signals/ingest error:", error);
    const message = error instanceof Error ? error.message : "Ingest failed";
    return NextResponse.json(
      { data: null, error: message },
      { status: 500 }
    );
  }
}
