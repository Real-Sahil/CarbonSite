import { spawn } from 'child_process';
import { prisma } from '@/lib/db';
import type { Job } from 'pg-boss';
import type { ChildProcess } from 'child_process';

export interface DbtTransformJobData {
  calculationRunId: string;
  organizationId: string;
}

export async function runDbtTransformation(calculationRunId: string, organizationId: string) {
  // TODO: Phase 2 feature — dbt transformation workflow
  // Requires: DbtRun table in Prisma schema, dbt CLI in PATH, environment configuration
  console.log(`[dbt-transform] Deferred for calculation run ${calculationRunId}`);

  // For now, just mark calculation run as succeeded without dbt transformation
  await prisma.calculationRun.update({
    where: { id: calculationRunId },
    data: {
      status: 'succeeded',
      finishedAt: new Date()
    }
  });

  return null;
}

async function executeDbtModels(env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const dbtProcess: ChildProcess = spawn('dbt', ['run', '--select', 'models/marts/*', '--profiles-dir', 'dbt'], {
      env,
      cwd: global.process.cwd()
    });

    dbtProcess.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
    });

    dbtProcess.stderr?.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    dbtProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`dbt run failed with exit code ${code}: ${errorOutput || output}`));
      }
    });

    dbtProcess.on('error', (err: Error) => {
      reject(err);
    });
  });
}

function parseDbtOutput(output: string): {
  rowsAffected: number;
  modelCount: number;
  testCount: number;
  testsPassed: number;
  testsFailed: number;
} {
  const stats = {
    rowsAffected: 0,
    modelCount: 0,
    testCount: 0,
    testsPassed: 0,
    testsFailed: 0
  };

  // Parse "Done. XXXX model(s) created/updated in XXXX.XXs." format
  const modelMatch = output.match(/Done\.\s+(\d+)\s+model/);
  if (modelMatch) {
    stats.modelCount = parseInt(modelMatch[1], 10);
  }

  // Parse test results "Completed successfully" or "XXXX of XXXX passed"
  const testPassMatch = output.match(/(\d+)\s+of\s+(\d+)\s+tests passed/i);
  if (testPassMatch) {
    stats.testsPassed = parseInt(testPassMatch[1], 10);
    stats.testCount = parseInt(testPassMatch[2], 10);
    stats.testsFailed = stats.testCount - stats.testsPassed;
  }

  // Try to extract rows affected from materializations
  const rowsMatch = output.match(/Creating table ".*?" \.\.\.\s+(\d+) rows/gi);
  if (rowsMatch) {
    stats.rowsAffected = rowsMatch.reduce((sum, match) => {
      const numMatch = match.match(/(\d+) rows/);
      return sum + (numMatch ? parseInt(numMatch[1], 10) : 0);
    }, 0);
  }

  return stats;
}

export async function handleDbtTransformJob(job: Job<DbtTransformJobData>) {
  const { calculationRunId, organizationId } = job.data;
  console.log(`[dbt-transform] starting for calculation run ${calculationRunId}`);
  await runDbtTransformation(calculationRunId, organizationId);
  console.log(`[dbt-transform] finished for calculation run ${calculationRunId}`);
}
