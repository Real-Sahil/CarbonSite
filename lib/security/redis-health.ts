// Redis health check utility for monitoring and debugging.
// Used to verify Redis connectivity and fallback behavior in production.

import Redis from "ioredis";
import { securityLogger } from "@/lib/logger";

export interface RedisHealthStatus {
  available: boolean;
  connected: boolean;
  latencyMs?: number;
  error?: string;
  fallbackReason?: string;
}

let cachedClient: Redis | null = null;
let cacheCheckTime = 0;
const CACHE_TTL = 30_000; // Cache health status for 30s

function getRedisClient(): Redis | null {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    if (!cachedClient) {
      cachedClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: false,
        enableOfflineQueue: false,
        connectTimeout: 5000,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
    }
    return cachedClient;
  } catch {
    return null;
  }
}

/**
 * Check Redis health and connectivity.
 * Returns cached status for up to 30 seconds to avoid overloading Redis with health checks.
 */
export async function checkRedisHealth(): Promise<RedisHealthStatus> {
  const now = Date.now();

  // Return cached status if fresh
  if (cacheCheckTime && now - cacheCheckTime < CACHE_TTL) {
    return getCachedStatus();
  }

  cacheCheckTime = now;
  const client = getRedisClient();

  if (!client) {
    return {
      available: false,
      connected: false,
      fallbackReason: !process.env.REDIS_URL ? "REDIS_URL not configured" : "Failed to initialize client",
    };
  }

  try {
    const startTime = Date.now();
    await client.ping();
    const latencyMs = Date.now() - startTime;

    return {
      available: true,
      connected: true,
      latencyMs,
    };
  } catch (error) {
    securityLogger.warn("Redis health check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      available: false,
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
      fallbackReason: "Redis unreachable, using Postgres fallback",
    };
  }
}

/**
 * Internal: Get cached status (used for test purposes).
 */
function getCachedStatus(): RedisHealthStatus {
  const client = getRedisClient();
  if (!client) {
    return {
      available: false,
      connected: false,
      fallbackReason: "Redis not configured",
    };
  }

  return {
    available: true,
    connected: client.status === "ready",
  };
}

/**
 * Force reconnection (useful for testing and diagnostics).
 */
export function resetRedisClient(): void {
  if (cachedClient) {
    cachedClient.disconnect();
    cachedClient = null;
  }
  cacheCheckTime = 0;
}
