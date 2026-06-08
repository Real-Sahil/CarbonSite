import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEnvironmentConfiguration } from "@/lib/env/verify";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = verifyEnvironmentConfiguration();
  const database = await checkDatabase();
  const ok = environment.ok && database.ok;

  return NextResponse.json(
    {
      checks: {
        database,
        environment: {
          errors: environment.errors,
          missing: environment.missing,
          mode: environment.mode,
          ok: environment.ok,
        },
      },
      ok,
      service: "carbonsite",
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  );
}

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "database_unreachable",
      detail: process.env.NODE_ENV === "production" ? undefined : formatError(error),
    };
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Database health check failed.";
}
