import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Cap the connection pool so Next.js serverless functions (which can spin up
// many concurrent instances) don't exhaust Supabase/Neon's connection limit.
// Supabase free tier: 60 direct connections. Keep pool small per process.
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const pooledUrl = DATABASE_URL.includes("connection_limit")
  ? DATABASE_URL
  : DATABASE_URL + (DATABASE_URL.includes("?") ? "&" : "?") + "connection_limit=5&pool_timeout=10";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: pooledUrl } },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
