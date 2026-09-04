import { z } from "zod";

// ─── Consolidation ───────────────────────────────────────────────────────────

export const consolidationApproachSchema = z.enum([
  "operational_control",
  "financial_control",
  "equity_share",
]);

export const updateConsolidationApproachSchema = z.object({
  consolidationApproach: consolidationApproachSchema,
  /// Changing the approach is a boundary change under GHG Protocol ch. 5, so
  /// the caller must say why before the structural change is logged.
  rationale: z.string().min(10).max(2000),
});

// ─── Legal entities ──────────────────────────────────────────────────────────

export const createLegalEntitySchema = z.object({
  name: z.string().min(1).max(200),
  registrationNumber: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  parentId: z.string().min(1).optional(),
  ownershipPercent: z.number().min(0).max(100).default(100),
  operationalControl: z.boolean().default(true),
  financialControl: z.boolean().default(true),
  acquiredOn: z.coerce.date().optional(),
  divestedOn: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateLegalEntitySchema = createLegalEntitySchema.partial();

// ─── Facility enrichment ─────────────────────────────────────────────────────

export const facilityProfileSchema = z.object({
  addressLine: z.string().max(300).optional(),
  postcode: z.string().max(20).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  siteType: z.string().max(60).optional(),
  floorAreaM2: z.number().min(0).max(100_000_000).optional(),
  headcount: z.number().int().min(0).max(1_000_000).optional(),
  legalEntityId: z.string().min(1).nullable().optional(),
  operationalControl: z.boolean().optional(),
  operationalFrom: z.coerce.date().optional(),
  operationalTo: z.coerce.date().optional(),
  externalRef: z.string().max(100).optional(),
});

// ─── Data provenance ─────────────────────────────────────────────────────────

export const dataOriginSchema = z.enum([
  "metered",
  "invoiced",
  "supplier_specific",
  "calculated",
  "estimated",
  "proxy",
  "extrapolated",
]);

/// Proxy and extrapolated figures must carry a written justification. This is
/// what an assurance provider asks for first, so it is enforced at the API
/// boundary rather than left to the UI.
export const setDataOriginSchema = z
  .object({
    dataOrigin: dataOriginSchema,
    dataOriginNote: z.string().max(1000).optional(),
  })
  .refine(
    (v) =>
      !["proxy", "extrapolated"].includes(v.dataOrigin) ||
      (v.dataOriginNote?.trim().length ?? 0) >= 10,
    {
      message:
        "A justification of at least 10 characters is required for proxy and extrapolated figures.",
      path: ["dataOriginNote"],
    },
  );

// ─── Base year ───────────────────────────────────────────────────────────────

export const createBaseYearSchema = z.object({
  reportingPeriodId: z.string().min(1),
  label: z.string().min(1).max(120),
  rationale: z.string().max(2000).optional(),
  significanceThresholdPercent: z.number().min(0).max(100).default(5),
});

export const updateBaseYearSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  rationale: z.string().max(2000).optional(),
  significanceThresholdPercent: z.number().min(0).max(100).optional(),
  status: z.enum(["draft", "active", "superseded"]).optional(),
});

// ─── Structural changes ──────────────────────────────────────────────────────

export const structuralChangeTypeSchema = z.enum([
  "acquisition",
  "divestiture",
  "merger",
  "outsourcing",
  "insourcing",
  "methodology_change",
  "boundary_change",
  "error_correction",
]);

export const createStructuralChangeSchema = z.object({
  type: structuralChangeTypeSchema,
  effectiveDate: z.coerce.date(),
  description: z.string().min(5).max(2000),
  legalEntityId: z.string().min(1).optional(),
  estimatedImpactCo2e: z.number().optional(),
  notes: z.string().max(2000).optional(),
});

// ─── Recalculations ──────────────────────────────────────────────────────────

export const resolveRecalculationSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  notes: z.string().max(2000).optional(),
});

// ─── Restatements ────────────────────────────────────────────────────────────

export const restatementReasonSchema = z.enum([
  "structural_change",
  "methodology_change",
  "factor_revision",
  "error_correction",
  "improved_data",
  "boundary_change",
]);

export const createRestatementSchema = z.object({
  supersededSnapshotId: z.string().min(1),
  replacementSnapshotId: z.string().min(1).optional(),
  reason: restatementReasonSchema,
  description: z.string().min(10).max(2000),
  previousTotalCo2e: z.number().optional(),
  restatedTotalCo2e: z.number().optional(),
});
