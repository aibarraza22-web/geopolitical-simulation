import { Queue, Worker } from "bullmq";

// =============================================================================
// Queue names
// =============================================================================
export const QUEUE_NAMES = {
  SIGNAL_INGEST: "signal-ingest",
  RISK_SCORER: "risk-scorer",
  ALERT_DISPATCHER: "alert-dispatcher",
  REPORT_GENERATOR: "report-generator",
} as const;

// =============================================================================
// Shared BullMQ connection config
// =============================================================================
const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD ?? undefined,
  maxRetriesPerRequest: null as null,
};

// =============================================================================
// Queue instances
// =============================================================================

export const signalIngestQueue = new Queue(QUEUE_NAMES.SIGNAL_INGEST, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

export const riskScorerQueue = new Queue(QUEUE_NAMES.RISK_SCORER, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
});

export const alertDispatcherQueue = new Queue(QUEUE_NAMES.ALERT_DISPATCHER, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 200 },
  },
});

// =============================================================================
// Job types
// =============================================================================

export interface SignalIngestJobData {
  source: "gdelt" | "rss" | "manual";
  query?: string;
  org_id?: string;
}

export interface RiskScorerJobData {
  regions?: string[];
  force?: boolean;
}

export interface AlertDispatcherJobData {
  alert_rule_id: string;
  signal_id: string;
  risk_score?: number;
}

// =============================================================================
// Schedule repeatable jobs (every 15 minutes)
// =============================================================================
export async function setupScheduledJobs(): Promise<void> {
  // GDELT ingest every 15 minutes
  await signalIngestQueue.upsertJobScheduler(
    "gdelt-ingest",
    { every: 15 * 60 * 1000 },
    {
      name: "gdelt-scheduled",
      data: { source: "gdelt" } as SignalIngestJobData,
      opts: { priority: 5 },
    }
  );

  // RSS ingest every 15 minutes
  await signalIngestQueue.upsertJobScheduler(
    "rss-ingest",
    { every: 15 * 60 * 1000 },
    {
      name: "rss-scheduled",
      data: { source: "rss" } as SignalIngestJobData,
      opts: { priority: 3 },
    }
  );

  // Risk score recalculation every 15 minutes (runs after ingest completes)
  await riskScorerQueue.upsertJobScheduler(
    "risk-score-all",
    { every: 15 * 60 * 1000 },
    {
      name: "risk-scorer-scheduled",
      data: { force: false } as RiskScorerJobData,
    }
  );

  console.log("[Queue] Scheduled jobs configured (15-minute intervals)");
}

// =============================================================================
// Start both workers (for standalone process usage)
// =============================================================================
export async function startWorkers(): Promise<void> {
  // Dynamically import to avoid circular dependency issues
  await import("./signal-ingester");
  await import("./risk-scorer");
  await setupScheduledJobs();
  console.log("[Queue] Workers started");
}
