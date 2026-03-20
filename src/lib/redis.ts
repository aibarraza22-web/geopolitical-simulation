import Redis from "ioredis";

// =============================================================================
// Redis client singleton
// =============================================================================

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (!_client) {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      _client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false,
      });
    } else {
      _client = new Redis({
        host: process.env.REDIS_HOST ?? "localhost",
        port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
        password: process.env.REDIS_PASSWORD ?? undefined,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableReadyCheck: false,
      });
    }

    _client.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    _client.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }

  return _client;
}

// =============================================================================
// Cache helpers
// =============================================================================

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Fail silently — cache is not critical
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.del(key);
  } catch {
    // Fail silently
  }
}

// Cache key builders
export const CacheKeys = {
  riskScores: () => "axiom:risk-scores:all",
  riskScore: (region: string) => `axiom:risk-score:${region}`,
  signals: (page: number, filters: string) => `axiom:signals:${page}:${filters}`,
  signalCount: () => "axiom:signals:count",
  globalKpi: () => "axiom:kpi:global",
};
