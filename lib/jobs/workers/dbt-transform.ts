import { prisma } from '@/lib/db';
import type { Job } from 'pg-boss';

export interface DbtTransformJobData {
  calculationRunId: string;
  organizationId: string;
}

export async function runDbtTransformation(calculationRunId: string, _organizationId: string) {
  // TODO: Implement dbt integration when DbtRun schema model is added
  console.log(`[dbt] Skipped dbt transformation for calculation run ${calculationRunId}`);

  // Mark calculation run as complete without dbt processing
  await prisma.calculationRun.update({
    where: { id: calculationRunId },
    data: {
      status: 'succeeded',
      finishedAt: new Date()
    }
  });
}


export async function handleDbtTransformJob(job: Job<DbtTransformJobData>) {
  const { calculationRunId, organizationId } = job.data;
  console.log(`[dbt-transform] starting for calculation run ${calculationRunId}`);
  await runDbtTransformation(calculationRunId, organizationId);
  console.log(`[dbt-transform] finished for calculation run ${calculationRunId}`);
}
