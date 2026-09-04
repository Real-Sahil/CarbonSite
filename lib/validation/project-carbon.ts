import { z } from "zod";

export const contractStatusSchema = z.enum(["active", "completed", "suspended", "cancelled"]);
export const projectStatusSchema = z.enum(["active", "completed", "on_hold", "cancelled"]);
export const subcontractorSubmissionStatusSchema = z.enum([
  "requested",
  "submitted",
  "verified",
  "rejected",
  "overdue",
]);

export const createContractSchema = z
  .object({
    name: z.string().min(1).max(200),
    clientName: z.string().max(200).optional(),
    contractReference: z.string().max(100).optional(),
    contractValue: z.number().min(0).optional(),
    currency: z.string().length(3).default("GBP"),
    status: contractStatusSchema.default("active"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    ppn0621Required: z.boolean().default(false),
    nhsEvergreenRequired: z.boolean().default(false),
    breeamRequired: z.boolean().default(false),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date cannot fall before the start date.",
    path: ["endDate"],
  });

export const updateContractSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientName: z.string().max(200).nullable().optional(),
  contractReference: z.string().max(100).nullable().optional(),
  contractValue: z.number().min(0).nullable().optional(),
  currency: z.string().length(3).optional(),
  status: contractStatusSchema.optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  ppn0621Required: z.boolean().optional(),
  nhsEvergreenRequired: z.boolean().optional(),
  breeamRequired: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createProjectSchema = z
  .object({
    name: z.string().min(1).max(200),
    projectCode: z.string().max(100).optional(),
    description: z.string().max(2000).optional(),
    status: projectStatusSchema.default("active"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date cannot fall before the start date.",
    path: ["endDate"],
  });

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  projectCode: z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  status: projectStatusSchema.optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
});

export const createSiteSchema = z.object({
  name: z.string().min(1).max(200),
  siteCode: z.string().max(100).optional(),
  postcode: z.string().max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(2).default("GB"),
});

export const updateSiteSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  siteCode: z.string().max(100).nullable().optional(),
  postcode: z.string().max(20).nullable().optional(),
  addressLine1: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  country: z.string().max(2).optional(),
});

export const carbonBudgetPhaseInputSchema = z.object({
  id: z.string().min(1).optional(), // present = update existing phase, absent = create new
  name: z.string().min(1).max(200),
  budgetTco2e: z.number().min(0),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

export const setCarbonBudgetSchema = z.object({
  totalBudgetTco2e: z.number().positive(),
  floorAreaM2: z.number().positive().nullable().optional(),
  contractValueGbp: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  phases: z.array(carbonBudgetPhaseInputSchema).default([]),
});

export const updateCarbonBudgetPhaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  budgetTco2e: z.number().min(0).optional(),
  actualTco2e: z.number().min(0).optional(),
  percentComplete: z.number().min(0).max(100).optional(),
  plannedCompletionDate: z.coerce.date().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const createSubcontractorSubmissionSchema = z.object({
  subcontractorName: z.string().min(1).max(200),
  contactEmail: z.string().email().optional(),
  reportingPeriodLabel: z.string().min(1).max(100),
  dueDate: z.coerce.date(),
  notes: z.string().max(2000).optional(),
});

export const updateSubcontractorSubmissionSchema = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("submit"),
      scope1Tco2e: z.number().min(0).optional(),
      scope2Tco2e: z.number().min(0).optional(),
      scope3Tco2e: z.number().min(0).optional(),
      evidenceStorageKey: z.string().min(1).max(500).optional(),
      notes: z.string().max(2000).optional(),
    }),
    z.object({
      action: z.literal("verify"),
    }),
    z.object({
      action: z.literal("reject"),
      rejectionReason: z.string().min(1).max(2000),
    }),
  ])
  .refine(
    (v) =>
      v.action !== "submit" ||
      v.scope1Tco2e != null ||
      v.scope2Tco2e != null ||
      v.scope3Tco2e != null,
    { message: "At least one of scope1Tco2e, scope2Tco2e or scope3Tco2e is required to submit.", path: ["scope1Tco2e"] },
  );

export const setWholeLifeCarbonAssessmentSchema = z.object({
  assessmentPeriodYears: z.number().int().min(1).max(120).default(60),
  operationalStartDate: z.coerce.date().nullable().optional(),
  operationalWaterKgCo2eManual: z.number().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
