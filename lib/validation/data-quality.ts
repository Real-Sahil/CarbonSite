import { prisma } from "@/lib/db";
import { Decimal } from "@prisma/client/runtime/library";

export interface QualityCheckResult {
  type: string;
  name: string;
  passed: boolean;
  failures?: Array<{
    rowNumber: number;
    field: string;
    value: any;
    expected: string;
  }>;
}

export async function validateImportBatch(
  batchId: string,
  orgId: string,
  records: any[],
): Promise<QualityCheckResult[]> {
  const checks: QualityCheckResult[] = [];

  if (records.length === 0) {
    return [
      {
        type: "volume",
        name: "Import has minimum rows",
        passed: false,
        failures: [{ rowNumber: 0, field: "row_count", value: 0, expected: ">= 1" }],
      },
    ];
  }

  // Check 1: Weight values must be positive and within realistic range
  checks.push(validateWeightRange(records));

  // Check 2: Unit validity
  checks.push(validateUnitValidity(records));

  // Check 3: Date range validation
  checks.push(validateDateRange(records));

  // Check 4: Completeness checks
  checks.push(validateCompleteness(records));

  // Check 5: Freshness checks
  checks.push(validateFreshness(records));

  // Check 6: Volume checks
  checks.push({
    type: "volume",
    name: "Import has minimum rows",
    passed: records.length >= 1 && records.length <= 100000,
    failures:
      records.length > 100000
        ? [{ rowNumber: 0, field: "row_count", value: records.length, expected: "<= 100000" }]
        : undefined,
  });

  return checks;
}

function validateWeightRange(records: any[]): QualityCheckResult {
  const failures: any[] = [];

  records.forEach((record, idx) => {
    const amount = parseFloat(record.normalizedAmount);
    if (isNaN(amount) || amount <= 0 || amount > 10000000) {
      failures.push({
        rowNumber: idx + 1,
        field: "normalizedAmount",
        value: record.normalizedAmount,
        expected: "> 0 and < 10,000,000",
      });
    }
  });

  return {
    type: "weight_range",
    name: "Weight must be positive and within range",
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined, // Sample first 5
  };
}

function validateUnitValidity(records: any[]): QualityCheckResult {
  const validUnits = ["kg", "tonnes", "litres", "kwh", "m3", "lbs", "gallons"];
  const failures: any[] = [];

  records.forEach((record, idx) => {
    if (record.normalizedUnit && !validUnits.includes(record.normalizedUnit.toLowerCase())) {
      failures.push({
        rowNumber: idx + 1,
        field: "normalizedUnit",
        value: record.normalizedUnit,
        expected: validUnits.join(", "),
      });
    }
  });

  return {
    type: "unit_validity",
    name: "Valid units only",
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
  };
}

function validateDateRange(records: any[]): QualityCheckResult {
  const now = new Date();
  const failures: any[] = [];

  records.forEach((record, idx) => {
    if (record.activityDate) {
      const date = new Date(record.activityDate);
      if (date > now) {
        failures.push({
          rowNumber: idx + 1,
          field: "activityDate",
          value: record.activityDate,
          expected: "<= today",
        });
      }
    }
  });

  return {
    type: "date_range",
    name: "Activity date not in future",
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
  };
}

function validateCompleteness(records: any[]): QualityCheckResult {
  const failures: any[] = [];

  records.forEach((record, idx) => {
    if (!record.emissionCategoryId) {
      failures.push({
        rowNumber: idx + 1,
        field: "emissionCategoryId",
        value: null,
        expected: "not null",
      });
    }
  });

  return {
    type: "completeness",
    name: "No null emission categories",
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
  };
}

function validateFreshness(records: any[]): QualityCheckResult {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const failures: any[] = [];

  records.forEach((record, idx) => {
    if (record.createdAt) {
      const date = new Date(record.createdAt);
      if (date < oneYearAgo) {
        failures.push({
          rowNumber: idx + 1,
          field: "createdAt",
          value: record.createdAt,
          expected: ">= 1 year old",
        });
      }
    }
  });

  return {
    type: "freshness",
    name: "Data not older than 1 year",
    passed: failures.length === 0,
    failures: failures.length > 0 ? failures.slice(0, 5) : undefined,
  };
}

export async function saveQualityCheckResults(
  batchId: string,
  orgId: string,
  checks: QualityCheckResult[],
): Promise<{ overallScore: number; canCommit: boolean }> {
  const checksPassed = checks.filter((c) => c.passed).length;
  const checksTotal = checks.length;
  const overallScore = (checksPassed / checksTotal) * 100;
  const canCommit = overallScore >= 80;

  // Save individual check results
  await Promise.all(
    checks.map((check) =>
      prisma.dataQualityCheck.create({
        data: {
          organizationId: orgId,
          importBatchId: batchId,
          checkType: check.type,
          checkName: check.name,
          passed: check.passed,
          failuresCount: check.failures?.length || 0,
          failureSamples: check.failures && check.failures.length > 0 ? check.failures : undefined,
          qualityScore: new Decimal(overallScore),
        },
      }),
    ),
  );

  // Save overall score
  await prisma.importBatchQualityScore.upsert({
    where: { importBatchId: batchId },
    update: {
      overallScore: new Decimal(overallScore),
      checksPassed,
      checksTotal,
      canCommit,
    },
    create: {
      organizationId: orgId,
      importBatchId: batchId,
      overallScore: new Decimal(overallScore),
      checksPassed,
      checksTotal,
      canCommit,
    },
  });

  return { overallScore, canCommit };
}
