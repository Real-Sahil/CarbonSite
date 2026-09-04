import { z } from "zod";

// ─── Shared metric vocabulary ────────────────────────────────────────────────

export const biodiversityModuleSchema = z.enum(["area", "hedgerow", "watercourse"]);
export const distinctivenessSchema = z.enum(["very_low", "low", "medium", "high", "very_high"]);
export const habitatConditionSchema = z.enum([
  "not_assessed",
  "poor",
  "fairly_poor",
  "moderate",
  "fairly_good",
  "good",
]);
export const strategicSignificanceSchema = z.enum(["low", "medium", "high"]);
export const difficultySchema = z.enum(["low", "medium", "high", "very_high"]);
export const spatialRiskSchema = z.enum(["on_site", "outside_neighbouring", "outside_distant"]);
export const parcelStageSchema = z.enum(["baseline", "retained", "enhanced", "created"]);

// ─── Assessments ─────────────────────────────────────────────────────────────

export const createAssessmentSchema = z.object({
  name: z.string().min(1).max(200),
  reference: z.string().max(120).optional(),
  projectId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  planningAuthority: z.string().max(200).optional(),
  planningReference: z.string().max(120).optional(),
  assessmentDate: z.coerce.date().optional(),
  ecologistName: z.string().max(200).optional(),
  ecologistOrganisation: z.string().max(200).optional(),
  notes: z.string().max(4000).optional(),
});

export const updateAssessmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  reference: z.string().max(120).nullable().optional(),
  status: z.enum(["draft", "submitted", "approved", "superseded"]).optional(),
  planningAuthority: z.string().max(200).nullable().optional(),
  planningReference: z.string().max(120).nullable().optional(),
  assessmentDate: z.coerce.date().nullable().optional(),
  ecologistName: z.string().max(200).nullable().optional(),
  ecologistOrganisation: z.string().max(200).nullable().optional(),
  securingMechanism: z
    .enum([
      "section_106",
      "conservation_covenant",
      "planning_condition",
      "statutory_credits",
      "not_yet_secured",
    ])
    .optional(),
  securedFrom: z.coerce.date().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

// ─── Habitat parcels ─────────────────────────────────────────────────────────

/// Units are never accepted from the client: they are derived from these
/// inputs server side so a parcel cannot hold a figure that disagrees with
/// its own metric terms.
export const createParcelSchema = z
  .object({
    stage: parcelStageSchema,
    module: biodiversityModuleSchema,
    broadHabitat: z.string().min(1).max(200),
    habitatType: z.string().min(1).max(200),
    // Hectares for area habitats, kilometres for hedgerows and watercourses.
    size: z.number().min(0).max(1_000_000),
    distinctiveness: distinctivenessSchema,
    condition: habitatConditionSchema.default("not_assessed"),
    strategicSignificance: strategicSignificanceSchema.default("low"),
    difficulty: difficultySchema.default("low"),
    yearsToTargetCondition: z.number().int().min(0).max(30).default(0),
    spatialRisk: spatialRiskSchema.default("on_site"),
    parcelReference: z.string().max(60).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (v) =>
      !["enhanced", "created"].includes(v.stage) ||
      v.yearsToTargetCondition > 0 ||
      v.distinctiveness === "very_low",
    {
      message:
        "Habitat being created or enhanced needs a realistic time to reach its target condition. Only very low distinctiveness habitat reaches target immediately.",
      path: ["yearsToTargetCondition"],
    },
  );

export const updateParcelSchema = createParcelSchema.innerType().partial();

// ─── Protected species ───────────────────────────────────────────────────────

export const speciesLicenceStatusSchema = z.enum([
  "not_required",
  "required",
  "applied",
  "granted",
  "refused",
  "expired",
]);

export const createSpeciesRecordSchema = z.object({
  assessmentId: z.string().min(1).optional(),
  siteId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  species: z.string().min(1).max(200),
  legalProtection: z.string().max(200).optional(),
  surveyDate: z.coerce.date().optional(),
  surveyorName: z.string().max(200).optional(),
  findings: z.string().min(1).max(4000),
  licenceStatus: speciesLicenceStatusSchema.default("not_required"),
  licenceReference: z.string().max(120).optional(),
  licenceExpiresOn: z.coerce.date().optional(),
  mitigation: z.string().max(4000).optional(),
  seasonalConstraint: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateSpeciesRecordSchema = createSpeciesRecordSchema.partial();

// ─── Management plan and monitoring ──────────────────────────────────────────

export const createManagementPlanSchema = z.object({
  title: z.string().min(1).max(200),
  responsibleParty: z.string().max(200).optional(),
  commencesOn: z.coerce.date(),
  managementObjectives: z.string().max(4000).optional(),
  prescriptions: z.string().max(4000).optional(),
  remediationStrategy: z.string().max(4000).optional(),
  fundingSecured: z.number().min(0).optional(),
  fundingCurrency: z.string().max(10).optional(),
  notes: z.string().max(2000).optional(),
  /// Years after commencement to schedule monitoring in. Defaults to the
  /// front-loaded schedule the metric guidance expects.
  monitoringYears: z.array(z.number().int().min(1).max(30)).max(30).optional(),
});

export const completeMonitoringSchema = z.object({
  completedOn: z.coerce.date(),
  surveyorName: z.string().max(200).optional(),
  conditionFound: habitatConditionSchema.optional(),
  onTrack: z.boolean(),
  findings: z.string().max(4000).optional(),
  remedialAction: z.string().max(4000).optional(),
});
