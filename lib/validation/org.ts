import { z } from "zod";

// ─── OrgRole enum (mirrors Prisma) ──────────────────────────────────────────

export const orgRoleSchema = z.enum([
  "admin",
  "editor",
  "reviewer",
  "viewer",
  "auditor",
  "field_worker",
]);

// ─── Organization ────────────────────────────────────────────────────────────

export const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  industry: z.string().optional(),
  hqCountry: z.string().optional(),
});

export const updateOrgSchema = createOrgSchema.partial();

// ─── Facility ────────────────────────────────────────────────────────────────

export const createFacilitySchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().optional(),
  region: z.string().optional(),
});

export const updateFacilitySchema = createFacilitySchema.partial();

// ─── BusinessUnit ────────────────────────────────────────────────────────────

export const createBusinessUnitSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateBusinessUnitSchema = createBusinessUnitSchema.partial();

// ─── ReportingPeriod ─────────────────────────────────────────────────────────

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createReportingPeriodSchema = z.object({
  type: z.enum(["month", "quarter", "year", "custom"]),
  startDate: z.string().regex(isoDateRegex, "Must be YYYY-MM-DD"),
  endDate: z.string().regex(isoDateRegex, "Must be YYYY-MM-DD"),
  label: z.string().min(1).max(100),
});

export const updateReportingPeriodSchema = createReportingPeriodSchema
  .partial()
  .extend({
    status: z.enum(["draft", "published", "locked"]).optional(),
  });

// ─── InviteLink ──────────────────────────────────────────────────────────────

export const createInviteLinkSchema = z.object({
  role: orgRoleSchema.default("field_worker"),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
});

// ─── Member management ───────────────────────────────────────────────────────

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: orgRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});

// ─── Presign upload ──────────────────────────────────────────────────────────

export const presignUploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
});

const optionalIsoDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(isoDateRegex, "Must be YYYY-MM-DD").optional(),
);

const optionalMoneySchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().nonnegative().optional(),
);

export const createReductionTargetSchema = z
  .object({
    baselinePeriodId: z.string().min(1),
    targetPeriodId: z.string().min(1),
    targetType: z.enum(["absolute", "intensity"]).default("absolute"),
    reductionAmount: z.coerce.number().positive(),
  })
  .refine((data) => data.baselinePeriodId !== data.targetPeriodId, {
    message: "Baseline and target periods must be different.",
    path: ["targetPeriodId"],
  });

export const createReductionInitiativeSchema = z.object({
  name: z.string().min(2).max(160),
  ownerUserId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  status: z
    .enum(["planned", "in_progress", "complete", "canceled"])
    .default("planned"),
  costAmount: optionalMoneySchema,
  costCurrency: z.string().min(3).max(3).default("GBP"),
  expectedImpactCo2e: optionalMoneySchema,
  expectedStartDate: optionalIsoDateSchema,
  notes: z.string().max(2000).optional(),
});

export const createActivityRecordSchema = z.object({
  reportingPeriodId: z.string().min(1),
  emissionCategoryId: z.string().min(1),
  activityDate: optionalIsoDateSchema,
  amount: z.coerce.number().positive(),
  unit: z.string().min(1).max(32),
  sourceDescription: z.string().max(240).optional(),
  facilityId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  businessUnitId: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  supplierName: z.string().max(160).optional(),
  country: z.string().max(80).optional(),
  reviewStatus: z
    .enum(["draft", "in_review", "approved", "rejected"])
    .default("draft"),
  evidenceStatus: z
    .enum(["missing", "partial", "complete"])
    .default("missing"),
  assumptionNotes: z.string().max(2000).optional(),
});

export const createReportSchema = z.object({
  reportingPeriodId: z.string().min(1),
  snapshotId: z.string().min(1),
  type: z.enum(["inventory", "monthly_snapshot", "audit_package"]),
});
