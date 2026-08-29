import { spawn } from 'child_process';
import { prisma } from '@/lib/db';
import type { Job } from 'pg-boss';
import type { ChildProcess } from 'child_process';

export interface DbtTransformJobData {
  calculationRunId: string;
  organizationId: string;
}

async function executeDbtModels(env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const dbtProcess: ChildProcess = spawn('dbt', ['run', '--select', 'models/marts/*', '--profiles-dir', 'dbt'], {
      env,
      cwd: process.cwd()
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

  const modelMatch = output.match(/Done\.\s+(\d+)\s+model/);
  if (modelMatch) {
    stats.modelCount = parseInt(modelMatch[1], 10);
  }

  const testPassMatch = output.match(/(\d+)\s+of\s+(\d+)\s+tests passed/i);
  if (testPassMatch) {
    stats.testsPassed = parseInt(testPassMatch[1], 10);
    stats.testCount = parseInt(testPassMatch[2], 10);
    stats.testsFailed = stats.testCount - stats.testsPassed;
  }

  const rowsMatch = output.match(/Creating table ".*?" \.\.\.\s+(\d+) rows/gi);
  if (rowsMatch) {
    stats.rowsAffected = rowsMatch.reduce((sum, match) => {
      const numMatch = match.match(/(\d+) rows/);
      return sum + (numMatch ? parseInt(numMatch[1], 10) : 0);
    }, 0);
  }

  return stats;
}

export async function runDbtTransformation(calculationRunId: string, organizationId: string) {
  const startTime = Date.now();
  let dbtRun = await prisma.dbtRun.create({
    data: {
      organizationId,
      calculationRunId,
      status: 'running',
      dbtCommand: 'dbt run --select models/marts/*'
    }
  });

  try {
    const env = { ...process.env, DBT_PROFILES_DIR: 'dbt' };
    const dbtOutput = await executeDbtModels(env);
    const stats = parseDbtOutput(dbtOutput);

    const duration = Date.now() - startTime;

    dbtRun = await prisma.dbtRun.update({
      where: { id: dbtRun.id },
      data: {
        status: 'succeeded',
        dbtOutput,
        rowsAffected: stats.rowsAffected,
        modelsCreated: stats.modelCount,
        testCount: stats.testCount,
        testsPassed: stats.testsPassed,
        testsFailed: stats.testsFailed,
        duration,
        completedAt: new Date()
      }
    });

    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: {
        status: 'succeeded',
        finishedAt: new Date()
      }
    });

    return dbtRun;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const duration = Date.now() - startTime;

    await prisma.dbtRun.update({
      where: { id: dbtRun.id },
      data: {
        status: 'failed',
        errorMessage,
        duration,
        completedAt: new Date()
      }
    });

    await prisma.calculationRun.update({
      where: { id: calculationRunId },
      data: {
        status: 'failed',
        errorMessage,
        finishedAt: new Date()
      }
    });

    throw error;
  }
}

export async function handleDbtTransformJob(job: Job<DbtTransformJobData>) {
  const { calculationRunId, organizationId } = job.data;
  await runDbtTransformation(calculationRunId, organizationId);
}
