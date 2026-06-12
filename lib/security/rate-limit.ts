// Fixed-window in-memory rate limiter. Suitable for a single-instance
// deployment (this stack runs one Next.js server, no serverless fan-out).
// If the app is ever scaled horizontally, replace the store with Postgres
// or another shared backend; the public API here stays the same.

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();

// Periodically drop expired windows so the map cannot grow unbounded.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, win] of store) {
    if (win.resetAt <= now) store.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const win = store.get(key);
  if (!win || win.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  win.count += 1;
  if (win.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((win.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - win.count, retryAfterSeconds: 0 };
}

// Route-class policies. Auth endpoints are the brute-force target; uploads
// and report generation are the resource-exhaustion targets.
export const POLICIES = {
  auth: { limit: 20, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  mutation: { limit: 120, windowMs: 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} as const;
