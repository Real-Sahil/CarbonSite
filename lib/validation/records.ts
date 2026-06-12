import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const createActivityRecordSchema = z.object({
  reportingPeriodId: z.string().min(1),
  emissionCategoryId: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1).max(50),
  activityDate: z.string().regex(isoDate, "Must be YYYY-MM-DD").optional(),
  startDate: z.string().regex(isoDate).optional(),
  endDate: z.string().regex(isoDate).optional(),
  sourceDescription: z.string().max(500).optional(),
  facilityId: z.string().optional(),
  businessUnitId: z.string().optional(),
  supplierName: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  region: z.string().max(100).optional(),
  spendAmount: z.number().positive().optional(),
  spendCurrency: z.string().max(10).optional(),
  distanceAmount: z.number().positive().optional(),
  distanceUnit: z.string().max(20).optional(),
  transportMode: z.string().max(100).optional(),
  fuelType: z.string().max(100).optional(),
  refrigerantType: z.string().max(100).optional(),
  scope2Method: z.enum(["location_based", "market_based"]).optional(),
  assumptionNotes: z.string().max(2000).optional(),
});

export const updateActivityRecordSchema = createActivityRecordSchema.partial();

export const reviewActivityRecordSchema = z.object({
  reviewStatus: z.enum(["draft", "in_review", "approved", "rejected"]),
  note: z.string().max(2000).optional(),
});

export const createCalculationRunSchema = z.object({
  reportingPeriodId: z.string().min(1),
  methodologyVersionId: z.string().min(1),
  factorLibraryId: z.string().min(1),
});

export const createTargetSchema = z.object({
  baselinePeriodId: z.string().min(1),
  targetPeriodId: z.string().min(1),
  targetType: z.enum(["absolute", "intensity"]).default("absolute"),
  reductionAmount: z.number().positive(),
});

export const createInitiativeSchema = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(["planned", "in_progress", "complete", "canceled"]).default("planned"),
  ownerUserId: z.string().optional(),
  costAmount: z.number().positive().optional(),
  costCurrency: z.string().max(10).optional(),
  expectedImpactCo2e: z.number().positive().optional(),
  expectedStartDate: z.string().regex(isoDate).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateInitiativeSchema = createInitiativeSchema.partial();

export const createFieldSubmissionSchema = z.object({
  reportingPeriodId: z.string().min(1),
  documentType: z.enum(["waste_ticket", "delivery_note", "fuel_receipt", "other"]),
  formData: z.record(z.any()),
  emissionCategoryId: z.string().optional(),
  facilityId: z.string().optional(),
  ocrExtractedData: z.record(z.any()).optional(),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  deviceSubmittedAt: z.string().datetime().optional(),
});

export const reviewFieldSubmissionSchema = z.object({
  action: z.enum(["approved", "rejected", "needs_info"]),
  emissionCategoryId: z.string().optional(),
  facilityId: z.string().optional(),
  reviewNote: z.string().max(2000).optional(),
});

export const createReviewTaskSchema = z.object({
  type: z.enum(["import_batch", "activity_record", "report"]),
  targetId: z.string().min(1),
  assigneeUserId: z.string().min(1),
});

export const updateReviewTaskSchema = z.object({
  status: z.enum(["open", "completed", "blocked"]),
});

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});
