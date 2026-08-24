import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyEnvironmentConfiguration } from "@/lib/env/verify";
import { checkStorageHealth } from "@/lib/storage/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const environment = verifyEnvironmentConfiguration();
  const [database, storage] = await Promise.all([
    checkDatabase(),
    checkStorageHealth(),
  ]);
  const authSchema = database.ok ? await checkAuthSchema() : { ok: false, missingColumns: [] };
  const ok = environment.ok && database.ok && authSchema.ok && storage.ok;

  return NextResponse.json(
    {
      checks: {
        authSchema,
        database,
        environment: {
          errors: environment.errors,
          missing: environment.missing,
          mode: environment.mode,
          ok: environment.ok,
        },
        storage,
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

async function checkAuthSchema() {
  const requiredColumns = [
    "users.email_verified",
    "users.image",
    "sessions.ip_address",
    "sessions.user_agent",
  ];

  try {
    const columns = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (
          (table_name = 'users' AND column_name IN ('email_verified', 'image'))
          OR (table_name = 'sessions' AND column_name IN ('ip_address', 'user_agent'))
        )
    `;
    const present = new Set(
      columns.map((column) => `${column.table_name}.${column.column_name}`),
    );
    const missingColumns = requiredColumns.filter((column) => !present.has(column));

    return {
      missingColumns,
      ok: missingColumns.length === 0,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "auth_schema_check_failed",
      detail: process.env.NODE_ENV === "production" ? undefined : formatError(error),
      missingColumns: requiredColumns,
    };
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Database health check failed.";
}
