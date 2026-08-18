import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Serverless (Next.js) can spin up many concurrent instances. Each PrismaClient
// opens its own connection pool, so without a global singleton every cold start
// consumes slots from the database's connection limit (Neon/Supabase free tier:
// 15–25 pooled slots). Fix: one client per process, shared via globalThis so
// hot-reloaded dev modules don't also leak connections.
//
// connection_limit=2: two connections per process is enough for Next.js (most
// pages make 1–3 sequential queries). pool_timeout=15: fail fast instead of
// queuing indefinitely when the pool is under pressure.
//
// If DATABASE_URL points to a PgBouncer/Neon pooler endpoint, also add
// pgbouncer=true so Prisma disables prepared statements (incompatible with
// transaction-mode pooling).
function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL ?? "";
  const params: string[] = [];
  if (!base.includes("connection_limit")) params.push("connection_limit=2");
  if (!base.includes("pool_timeout")) params.push("pool_timeout=15");
  if (!base.includes("pgbouncer") && (base.includes("pooler") || base.includes("pgbouncer"))) {
    params.push("pgbouncer=true");
  }
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
