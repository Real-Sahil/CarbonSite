import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Serverless (Next.js) can spin up many concurrent instances. Each PrismaClient
// opens its own connection pool. Without a global singleton every cold start
// consumes slots from the database's connection limit (Supabase free tier: 15
// session-mode slots). Fix: one client per process, shared via globalThis so
// hot-reloaded dev modules don't also leak connections.
//
// connection_limit=1: one connection per serverless function instance is the
// Prisma recommendation for Supabase/PgBouncer transaction-mode pooling.
// Supabase's transaction-mode pooler (port 6543) can multiplex many concurrent
// functions over the same 15 pooler slots because each connection is released
// after every transaction. pool_timeout=15: fail fast instead of queuing
// indefinitely under pressure.
//
// DATABASE_URL should point to Supabase's transaction-mode pooler (port 6543)
// with ?pgbouncer=true&connection_limit=1. DIRECT_URL should be the direct
// connection (port 5432) for prisma migrate deploy.
function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? "";
  const params: string[] = [];
  // Detect transaction-mode pooler by URL containing "pooler" or using port 6543.
  const isPooler = base.includes("pooler") || /:6543[/?]/.test(base) || base.endsWith(":6543");
  if (!base.includes("connection_limit")) params.push("connection_limit=1");
  if (!base.includes("pool_timeout")) params.push("pool_timeout=15");
  if (isPooler && !base.includes("pgbouncer")) params.push("pgbouncer=true");
  if (params.length === 0) return base;
  return base + (base.includes("?") ? "&" : "?") + params.join("&");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: buildDatabaseUrl() } },
  });

// Always cache on globalThis — not just in development. In production each
// module-level import would otherwise instantiate a new client and leak
// connections until the process is recycled.
globalForPrisma.prisma = prisma;
