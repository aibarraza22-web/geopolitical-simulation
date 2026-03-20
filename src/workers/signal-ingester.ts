import { Worker, type Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { getAnthropicClient, buildNLPPrompt } from "@/lib/anthropic";
import { fetchAllGdeltSignals } from "@/lib/signal-processors/gdelt";
import { fetchAllRssSignals } from "@/lib/signal-processors/rss";
import {
  QUEUE_NAMES,
  riskScorerQueue,
  type SignalIngestJobData,
} from "./queue";
import type { Signal } from "@/types";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
  maxRetriesPerRequest: null as null,
};

function getSupabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================================================
// Compute a simple content hash for deduplication
// =============================================================================
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

// =============================================================================
// Enrich a raw signal through Claude NLP pipeline
// =============================================================================
async function processRawSignal(rawSignal: Partial<Signal>): Promise<Signal | null> {
  if (!rawSignal.raw_text && !rawSignal.headline) return null;
  const text = rawSignal.raw_text ?? rawSignal.headline ?? "";
  if (text.length < 20) return null;

  try {
    const anthropic = getAnthropicClient();
    const prompt = buildNLPPrompt(text);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") return null;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const nlpResult = JSON.parse(jsonMatch[0]) as Partial<Signal>;

    const headline = nlpResult.headline ?? rawSignal.headline ?? text.slice(0, 120);
    const source = rawSignal.source ?? "Unknown";

    const enrichedSignal: Signal = {
      id: rawSignal.id ?? crypto.randomUUID(),
      org_id: rawSignal.org_id ?? "global",
      headline,
      summary: nlpResult.summary ?? rawSignal.summary ?? "",
      source,
      source_url: rawSignal.source_url ?? "",
      published_at: rawSignal.published_at ?? new Date().toISOString(),
      ingested_at: new Date().toISOString(),
      severity: nlpResult.severity ?? rawSignal.severity ?? "INFO",
      domain: nlpResult.domain ?? rawSignal.domain ?? "Political",
      regions: nlpResult.regions ?? rawSignal.regions ?? [],
      countries: nlpResult.countries ?? rawSignal.countries ?? [],
      asset_classes: nlpResult.asset_classes ?? rawSignal.asset_classes ?? [],
      entities: nlpResult.entities ?? rawSignal.entities ?? [],
      sentiment_score: nlpResult.sentiment_score ?? rawSignal.sentiment_score ?? 0,
      relevance_score: nlpResult.relevance_score ?? rawSignal.relevance_score ?? 0.5,
      raw_text: text,
    };

    return enrichedSignal;
  } catch (err) {
    console.error("[SignalIngester] NLP processing error:", err);
    return null;
  }
}

// =============================================================================
// Process a single ingest job
// =============================================================================
async function processJob(job: Job<SignalIngestJobData>): Promise<void> {
  const { source } = job.data;
  console.log(`[SignalIngester] Processing job ${job.id}: source=${source}`);

  let rawSignals: Partial<Signal>[] = [];

  if (source === "gdelt") {
    rawSignals = await fetchAllGdeltSignals();
    console.log(`[SignalIngester] Fetched ${rawSignals.length} GDELT signals`);
  } else if (source === "rss") {
    rawSignals = await fetchAllRssSignals();
    console.log(`[SignalIngester] Fetched ${rawSignals.length} RSS signals`);
  }

  // Filter to relevant signals before expensive NLP calls
  const relevantRaw = rawSignals.filter(
    (s) =>
      (s.relevance_score ?? 0) >= 0.5 ||
      s.severity === "CRITICAL" ||
      s.severity === "HIGH" ||
      (s.regions && s.regions.length > 0)
  );

  console.log(
    `[SignalIngester] Processing ${relevantRaw.length} relevant signals through Claude NLP`
  );

  // Process in batches of 5 to respect rate limits
  const batchSize = 5;
  const processedSignals: Signal[] = [];

  for (let i = 0; i < relevantRaw.length; i += batchSize) {
    const batch = relevantRaw.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((raw) => processRawSignal(raw))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        processedSignals.push(result.value);
      }
    }

    if (i + batchSize < relevantRaw.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`[SignalIngester] Enriched ${processedSignals.length} signals`);

  if (processedSignals.length === 0) {
    console.log("[SignalIngester] No signals to store");
    return;
  }

  // Upsert into Supabase — skip duplicates via content_hash
  const supabase = getSupabaseService();

  const rows = processedSignals.map((s) => ({
    ...s,
    content_hash: contentHash(s.headline, s.source),
    embedding: null, // pgvector placeholder
  }));

  const { error, count } = await supabase
    .from("signals")
    .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[SignalIngester] Supabase upsert error:", error.message);
  } else {
    console.log(`[SignalIngester] Upserted ${count ?? processedSignals.length} signals`);
  }

  // Queue risk recalculation for affected regions
  const affectedRegions = [
    ...new Set(processedSignals.flatMap((s) => s.regions)),
  ];

  if (affectedRegions.length > 0) {
    await riskScorerQueue.add(
      "recalculate-affected",
      { regions: affectedRegions, force: false },
      { priority: 8 }
    );
    console.log(
      `[SignalIngester] Queued risk recalculation for: ${affectedRegions.join(", ")}`
    );
  }
}

// =============================================================================
// Worker instance
// =============================================================================
const worker = new Worker<SignalIngestJobData>(
  QUEUE_NAMES.SIGNAL_INGEST,
  processJob,
  {
    connection,
    concurrency: 2,
    limiter: {
      max: 10,
      duration: 60000,
    },
  }
);

worker.on("completed", (job) => {
  console.log(`[SignalIngester] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[SignalIngester] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[SignalIngester] Worker error:", err);
});

console.log("[SignalIngester] Worker started");

process.on("SIGTERM", async () => {
  console.log("[SignalIngester] Shutting down gracefully...");
  await worker.close();
  process.exit(0);
});

export default worker;
