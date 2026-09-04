import { z } from "zod";

export const assuranceStandardSchema = z.enum(["isae_3000", "iso_14064_3", "aa1000as", "other"]);
export const assuranceLevelSchema = z.enum(["limited", "reasonable"]);
export const engagementStatusSchema = z.enum([
  "planning",
  "fieldwork",
  "review",
  "signed",
  "withdrawn",
]);

export const createEngagementSchema = z
  .object({
    reportingPeriodId: z.string().min(1),
    snapshotId: z.string().min(1).optional(),
    standard: assuranceStandardSchema.default("isae_3000"),
    level: assuranceLevelSchema.default("limited"),
    providerName: z.string().min(1).max(200),
    leadAssurorName: z.string().min(1).max(200),
    leadAssurorEmail: z.string().email().optional(),
    materialityThresholdCo2e: z.number().min(0).optional(),
    materialityThresholdPercent: z.number().min(0).max(100).optional(),
    scopeDescription: z.string().max(4000).optional(),
    plannedStartDate: z.coerce.date().optional(),
    plannedEndDate: z.coerce.date().optional(),
  })
  .refine((v) => !v.plannedStartDate || !v.plannedEndDate || v.plannedEndDate >= v.plannedStartDate, {
    message: "Planned end date cannot fall before the planned start date.",
    path: ["plannedEndDate"],
  });

export const updateEngagementSchema = z.object({
  status: engagementStatusSchema.optional(),
  providerName: z.string().min(1).max(200).optional(),
  leadAssurorName: z.string().min(1).max(200).optional(),
  leadAssurorEmail: z.string().email().nullable().optional(),
  materialityThresholdCo2e: z.number().min(0).nullable().optional(),
  materialityThresholdPercent: z.number().min(0).max(100).nullable().optional(),
  scopeDescription: z.string().max(4000).nullable().optional(),
  plannedStartDate: z.coerce.date().nullable().optional(),
  plannedEndDate: z.coerce.date().nullable().optional(),
  opinionSummary: z.string().max(4000).nullable().optional(),
});

export const createEvidenceRequestSchema = z.object({
  reference: z.string().min(1).max(60),
  description: z.string().min(1).max(2000),
  category: z.string().max(100).optional(),
  ownerUserId: z.string().min(1).optional(),
  dueOn: z.coerce.date().optional(),
});

export const updateEvidenceRequestSchema = z.object({
  status: z.enum(["requested", "provided", "not_available", "not_applicable"]).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  dueOn: z.coerce.date().nullable().optional(),
  unavailabilityReason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const generateSamplingPlanSchema = z.object({
  targetSampleSize: z.number().int().min(1).max(500).default(25),
  materialityThresholdCo2e: z.number().min(0).optional(),
});

export const createManualSampleSchema = z.object({
  emissionCalculationId: z.string().min(1).optional(),
  activityRecordId: z.string().min(1).optional(),
  samplingMethod: z.enum(["full_population", "risk_based", "random", "targeted"]),
  selectionRationale: z.string().min(1).max(2000),
  testProcedure: z.string().min(1).max(2000),
});

export const recordSampleResultSchema = z.object({
  result: z.enum(["pending", "pass", "exception_resolved", "fail"]),
  testNotes: z.string().max(4000).optional(),
});

export const createFindingSchema = z.object({
  sampleId: z.string().min(1).optional(),
  severity: z.enum(["observation", "minor", "significant", "material_misstatement"]),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(4000),
  quantifiedImpactCo2e: z.number().optional(),
});

export const respondToFindingSchema = z.object({
  managementResponse: z.string().min(1).max(4000),
});

export const resolveFindingSchema = z.object({
  status: z.enum(["resolved", "qualified"]),
});

export const recordDatapointStatusSchema = z.object({
  status: z.enum(["satisfied", "partial", "gap", "not_applicable"]),
  evidenceSummary: z.string().max(2000).optional(),
});
