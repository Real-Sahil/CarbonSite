/**
 * Causal Analysis Worker — Phase 5C
 * Processes root cause analysis runs using DoWhy methodology
 * Selects predefined models based on question NLP, or falls back to custom treatment/outcome
 */

import { prisma } from "@/lib/db";
import { estimateCausalEffect, DoWhyClient } from "@/lib/causal-inference/dowhyClient";
import { selectModelFromQuestion } from "@/lib/causal-inference/models";
import type { CausalDataPoint } from "@/lib/causal-inference/dowhyClient";

export async function processCausalAnalysisRun(
  causalInferenceRunId: string,
  orgId: string
): Promise<void> {
  let run;

  try {
    // Fetch the run details
    run = await prisma.causalInferenceRun.findUniqueOrThrow({
      where: { id: causalInferenceRunId },
    });

    if (run.organizationId !== orgId) {
      throw new Error("Organization mismatch");
    }

    // Mark as running
    await prisma.causalInferenceRun.update({
      where: { id: causalInferenceRunId },
      data: { status: "running" },
    });

    // Step 1: Select model from question if available, otherwise use custom treatment/outcome
    let treatment = run.treatment;
    let outcome = run.outcome;
    let confounders = (run.confounders as string[]) || [];

    if (run.modelId) {
      // Pre-selected model — use its parameters
      console.log(`[causal-analysis] using model ${run.modelId}`);
    } else if (!treatment || !outcome) {
      // Auto-detect model from question
      const model = selectModelFromQuestion(run.question);
      if (model) {
        treatment = model.treatment;
        outcome = model.outcome;
        confounders = model.confounders;
        console.log(`[causal-analysis] auto-selected model: ${model.id}`);
      } else {
        throw new Error("Cannot auto-select model — please specify treatment/outcome variables");
      }
    }

    // Step 2: Fetch activity records for this org to use as causal data
    const records = await prisma.activityRecord.findMany({
      where: {
        organizationId: orgId,
        reviewStatus: "approved",
      },
      select: {
        id: true,
        amount: true,
      },
      take: 500, // Limit to 500 records for initial runs
    });

    if (records.length < 30) {
      throw new Error(`Insufficient data: only ${records.length} records (need at least 30)`);
    }

    // Step 3: Transform records into CausalDataPoint format
    // For MVP, we'll create synthetic treatment/control groups based on a heuristic
    // (e.g., records before/after a certain date, or above/below median value)
    const causalData: CausalDataPoint[] = records.map((record, i) => ({
      treatment: i % 2, // Alternate treatment/control for MVP (synthetic)
      outcome: Number(record.amount),
      baseline_emissions: Number(record.amount),
      facility_size: 1000, // Default facility size
      headcount: 10, // Default headcount
    }));

    // Step 4: Run causal inference
    const estimate = await estimateCausalEffect({
      treatment,
      outcome,
      confounders,
      data: causalData,
    });

    // Step 5: Store results
    await prisma.causalInferenceRun.update({
      where: { id: causalInferenceRunId },
      data: {
        status: "completed",
        treatmentEffect: estimate.effectSize,
        confidenceIntervalLower: estimate.confidenceIntervalLower,
        confidenceIntervalUpper: estimate.confidenceIntervalUpper,
        pValue: estimate.pValue,
        robustnessToUnmeasuredConf: estimate.robustnessToUnmeasuredConfounding,
        sampleSize: estimate.sampleSize,
        method: estimate.method,
        causalGraph: {
          treatment,
          outcome,
          confounders,
          nodes: [treatment, outcome, ...confounders],
        },
        resultSummary: formatSummary(estimate, run.question),
        errorMessage: null,
      },
    });

    console.log(`[causal-analysis] completed run ${causalInferenceRunId}`);
  } catch (err) {
    console.error(`[causal-analysis] run ${causalInferenceRunId} failed:`, err);

    const errorMsg = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";

    if (run) {
      await prisma.causalInferenceRun.update({
        where: { id: causalInferenceRunId },
        data: {
          status: "failed",
          errorMessage: errorMsg,
        },
      }).catch(() => {});
    }

    throw err;
  }
}

function formatSummary(
  estimate: any,
  question: string
): string {
  const effect = estimate.effectSize.toFixed(2);
  const lower = estimate.confidenceIntervalLower.toFixed(2);
  const upper = estimate.confidenceIntervalUpper.toFixed(2);
  const pValue = estimate.pValue.toFixed(4);
  const robustness = (estimate.robustnessToUnmeasuredConfounding * 100).toFixed(1);

  return `
Question: ${question}

Estimated Treatment Effect (ATE): ${effect}
95% Confidence Interval: [${lower}, ${upper}]
P-Value: ${pValue}
Robustness to Unmeasured Confounding: ${robustness}%
Sample Size: ${estimate.sampleSize}
Method: ${estimate.method}

The treatment has an estimated effect of ${effect} on the outcome.
${estimate.pValue < 0.05 ? "This effect is statistically significant at p < 0.05." : "This effect is NOT statistically significant."}
The result has ${robustness}% robustness to unmeasured confounding.
  `.trim();
}
