/**
 * dbt SQL Transformation Worker
 * Runs dbt models to transform raw activity records into analytical tables
 * Triggered after calculation runs complete
 */

import { spawn } from "child_process";
import { prisma } from "@/lib/db";

interface DbtRunMetadata {
  calculationRunId: string;
  organizationId: string;
  startDate: string;
  endDate: string;
}

/**
 * Run dbt transformation for a calculation run
 * Executes: stg_* views → fct_* facts → agg_* aggregates
 */
export async function runDbtTransformation(
  calculationRunId: string,
  organizationId: string,
  options?: { dryRun?: boolean; models?: string[] }
): Promise<{ success: boolean; rowsAffected: number; duration: number }> {
  const startTime = Date.now();
  const modelSelector = options?.models?.join(",") || "tag:marts";

  console.log(`[dbt] Starting transformation for org ${organizationId}, calc run ${calculationRunId}`);

  try {
    // 1. Fetch reporting period to set date filter
    const calculationRun = await prisma.calculationRun.findUniqueOrThrow({
      where: { id: calculationRunId },
      include: { reportingPeriod: true },
    });

    const startDate = calculationRun.reportingPeriod.startDate.toISOString().split("T")[0];
    const endDate = calculationRun.reportingPeriod.endDate.toISOString().split("T")[0];

    // 2. Build dbt command
    const dbtArgs = [
      "run",
      "--select",
      modelSelector,
      "--vars",
      JSON.stringify({
        org_id: organizationId,
        calculation_run_id: calculationRunId,
        start_date: startDate,
        end_date: endDate,
      }),
    ];

    if (options?.dryRun) {
      dbtArgs.push("--debug");
    }

    console.log(`[dbt] Executing: dbt ${dbtArgs.join(" ")}`);

    // 3. Run dbt process
    const output = await executeDbT(dbtArgs);
    const rowsAffected = parseDbTOutput(output);
    const duration = Date.now() - startTime;

    // 4. Log successful run
    await prisma.dbtRun.create({
      data: {
        calculationRunId,
        organizationId,
        status: "success",
        output,
        rowsAffected,
        duration,
        modelsRun: modelSelector,
      },
    });

    console.log(`[dbt] ✓ Transformation complete (${rowsAffected} rows, ${duration}ms)`);

    return { success: true, rowsAffected, duration };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    console.error(`[dbt] ✗ Transformation failed: ${errorMsg}`);

    // Log failed run
    await prisma.dbtRun.create({
      data: {
        calculationRunId,
        organizationId,
        status: "failed",
        output: errorMsg,
        rowsAffected: 0,
        duration,
        modelsRun: modelSelector,
      },
    });

    throw error;
  }
}

/**
 * Execute dbt command and capture output
 */
async function executeDbT(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const dbtProcess = spawn("dbt", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DBT_PROFILES_DIR: process.cwd(),
      },
    });

    let stdout = "";
    let stderr = "";

    dbtProcess.stdout?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[dbt out] ${chunk.trim()}`);
    });

    dbtProcess.stderr?.on("data", (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      console.error(`[dbt err] ${chunk.trim()}`);
    });

    dbtProcess.on("close", (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`dbt exited with code ${code}: ${stderr || stdout}`));
      }
    });

    dbtProcess.on("error", (err: Error) => {
      reject(new Error(`Failed to start dbt process: ${err.message}`));
    });
  });
}

/**
 * Parse dbt output to extract rows affected count
 * dbt output includes lines like:
 *   Running with dbt=1.0.0
 *   Creating table public.fct_emissions ... [CREATE TABLE] OK created
 *   Creating incremental model public.agg_daily_emissions ... [INSERT 500 0] OK inserted in 2.34s
 */
function parseDbTOutput(output: string): number {
  let totalRows = 0;

  // Match patterns like "[INSERT 500 0]" or "[CREATE TABLE]"
  const insertMatches = output.match(/\[INSERT (\d+) \d+\]/g);
  if (insertMatches) {
    insertMatches.forEach((match) => {
      const rows = parseInt(match.match(/\d+/)?.[0] || "0");
      totalRows += rows;
    });
  }

  // Log parsing result
  console.log(`[dbt parse] Extracted ${totalRows} total rows from dbt output`);

  return totalRows;
}

/**
 * Get dbt run history for monitoring/debugging
 */
export async function getDbTRunHistory(orgId: string, limit: number = 10) {
  return prisma.dbtRun.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Check if latest dbt run succeeded
 */
export async function isLatestDbTRunSuccessful(orgId: string): Promise<boolean> {
  const latest = await prisma.dbtRun.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });

  return latest?.status === "success";
}
