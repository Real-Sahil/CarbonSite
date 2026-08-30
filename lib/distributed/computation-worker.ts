/**
 * Computation Worker
 *
 * Handles compute-intensive tasks in a separate thread:
 * - Emission calculations from large datasets
 * - Data validation and quality checks
 * - Aggregation operations
 * - Scope 3 factor estimation
 */

interface WorkerMessage {
  id: string;
  type: "calculate_emissions" | "validate_records" | "aggregate_data" | "estimate_factors";
  data: unknown;
}

interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

// Task handlers
function calculateEmissions(data: unknown): unknown {
  const records = data as Array<{
    amount: number;
    factor: number;
    gwpCh4?: number;
    gwpN2o?: number;
  }>;

  return records.map((record) => {
    const baseCo2e = record.amount * record.factor;
    const ch4Contribution = (record.gwpCh4 || 0) * record.amount;
    const n2oContribution = (record.gwpN2o || 0) * record.amount;
    return {
      co2e: baseCo2e,
      total: baseCo2e + ch4Contribution + n2oContribution,
    };
  });
}

function validateRecords(data: unknown): unknown {
  const records = data as Array<{
    id: string;
    amount: number;
    unit: string;
    category: string;
    date: string;
  }>;

  const validation = {
    valid: 0,
    invalid: 0,
    errors: [] as Array<{ recordId: string; reason: string }>,
  };

  for (const record of records) {
    let hasError = false;

    if (record.amount < 0) {
      validation.errors.push({
        recordId: record.id,
        reason: "Negative amount",
      });
      hasError = true;
    }

    if (!record.unit) {
      validation.errors.push({
        recordId: record.id,
        reason: "Missing unit",
      });
      hasError = true;
    }

    if (isNaN(new Date(record.date).getTime())) {
      validation.errors.push({
        recordId: record.id,
        reason: "Invalid date",
      });
      hasError = true;
    }

    if (hasError) {
      validation.invalid++;
    } else {
      validation.valid++;
    }
  }

  return validation;
}

function aggregateData(data: unknown): unknown {
  const records = data as Array<{
    category: string;
    value: number;
  }>;

  const aggregation: Record<string, number> = {};
  const counts: Record<string, number> = {};

  for (const record of records) {
    const cat = record.category;
    aggregation[cat] = (aggregation[cat] || 0) + record.value;
    counts[cat] = (counts[cat] || 0) + 1;
  }

  return {
    totals: aggregation,
    averages: Object.entries(aggregation).reduce(
      (acc, [cat, total]) => {
        acc[cat] = total / (counts[cat] || 1);
        return acc;
      },
      {} as Record<string, number>
    ),
    recordCounts: counts,
  };
}

function estimateFactors(data: unknown): unknown {
  const records = data as Array<{
    id: string;
    historical: number[];
    current: number;
  }>;

  return records.map((record) => {
    const mean =
      record.historical.length > 0
        ? record.historical.reduce((a, b) => a + b, 0) / record.historical.length
        : 0;

    const variance =
      record.historical.length > 0
        ? record.historical.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          record.historical.length
        : 0;

    const stdDev = Math.sqrt(variance);
    const zScore = stdDev > 0 ? (record.current - mean) / stdDev : 0;
    const isOutlier = Math.abs(zScore) > 2;

    return {
      id: record.id,
      estimatedFactor: mean,
      confidence: 1 - stdDev / (mean || 1),
      isOutlier,
      zscore: zScore,
    };
  });
}

// Main worker message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  const startTime = performance.now();

  try {
    let result: unknown;

    switch (type) {
      case "calculate_emissions":
        result = calculateEmissions(data);
        break;
      case "validate_records":
        result = validateRecords(data);
        break;
      case "aggregate_data":
        result = aggregateData(data);
        break;
      case "estimate_factors":
        result = estimateFactors(data);
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }

    const duration = performance.now() - startTime;

    const response: WorkerResult = {
      taskId: id,
      success: true,
      result,
      duration,
    };

    self.postMessage(response);
  } catch (error) {
    const duration = performance.now() - startTime;

    const response: WorkerResult = {
      taskId: id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };

    self.postMessage(response);
  }
};
