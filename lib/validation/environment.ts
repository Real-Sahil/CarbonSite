import { z } from "zod";

// ─── Permits ─────────────────────────────────────────────────────────────────

export const permitTypeSchema = z.enum([
  "environmental_permit",
  "discharge_consent",
  "abstraction_licence",
  "waste_carrier_licence",
  "waste_management_licence",
  "air_emissions_permit",
  "radioactive_substances",
  "species_licence",
  "planning_condition",
  "other",
]);

export const permitStatusSchema = z.enum([
  "draft",
  "applied",
  "active",
  "expired",
  "suspended",
  "revoked",
  "surrendered",
]);

export const complianceStatusSchema = z.enum([
  "compliant",
  "at_risk",
  "breach",
  "not_assessed",
]);

export const createPermitSchema = z
  .object({
    type: permitTypeSchema,
    reference: z.string().min(1).max(120),
    issuingAuthority: z.string().min(1).max(200),
    title: z.string().min(1).max(300),
    description: z.string().max(2000).optional(),
    status: permitStatusSchema.default("active"),
    facilityId: z.string().min(1).optional(),
    siteId: z.string().min(1).optional(),
    issuedOn: z.coerce.date().optional(),
    effectiveFrom: z.coerce.date().optional(),
    expiresOn: z.coerce.date().optional(),
    // Lead time for starting a renewal. Regimes differ widely, from a few
    // weeks for a carrier registration to most of a year for a bespoke permit.
    renewalNoticeDays: z.number().int().min(0).max(1095).default(90),
    ownerUserId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => !v.effectiveFrom || !v.expiresOn || v.expiresOn >= v.effectiveFrom, {
    message: "Expiry cannot fall before the effective date.",
    path: ["expiresOn"],
  });

export const updatePermitSchema = z.object({
  type: permitTypeSchema.optional(),
  reference: z.string().min(1).max(120).optional(),
  issuingAuthority: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: permitStatusSchema.optional(),
  facilityId: z.string().min(1).nullable().optional(),
  siteId: z.string().min(1).nullable().optional(),
  issuedOn: z.coerce.date().nullable().optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  expiresOn: z.coerce.date().nullable().optional(),
  renewalNoticeDays: z.number().int().min(0).max(1095).optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const createPermitConditionSchema = z.object({
  reference: z.string().min(1).max(60),
  description: z.string().min(1).max(2000),
  limitValue: z.number().optional(),
  limitUnit: z.string().max(40).optional(),
  monitoringFrequency: z.string().max(60).optional(),
  complianceStatus: complianceStatusSchema.default("not_assessed"),
  lastAssessedOn: z.coerce.date().optional(),
  nextDueOn: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

export const updatePermitConditionSchema = createPermitConditionSchema.partial();

// ─── Legal register ──────────────────────────────────────────────────────────

export const createLegalRegisterEntrySchema = z.object({
  title: z.string().min(1).max(300),
  citation: z.string().max(200).optional(),
  jurisdiction: z.string().max(120).optional(),
  applicability: z.string().min(1).max(2000),
  obligation: z.string().min(1).max(2000),
  complianceStatus: complianceStatusSchema.default("not_assessed"),
  evidenceSummary: z.string().max(2000).optional(),
  ownerUserId: z.string().min(1).optional(),
  lastReviewedOn: z.coerce.date().optional(),
  nextReviewOn: z.coerce.date().optional(),
  referenceUrl: z.string().url().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateLegalRegisterEntrySchema = createLegalRegisterEntrySchema.partial();

// ─── Incidents ───────────────────────────────────────────────────────────────

export const incidentTypeSchema = z.enum([
  "spill",
  "exceedance",
  "unauthorised_release",
  "complaint",
  "near_miss",
  "waste_misrouting",
  "equipment_failure",
  "ecological_damage",
  "other",
]);

export const incidentSeveritySchema = z.enum([
  "negligible",
  "minor",
  "moderate",
  "major",
  "severe",
]);

export const incidentStatusSchema = z.enum([
  "reported",
  "investigating",
  "contained",
  "awaiting_action",
  "closed",
]);

export const createIncidentSchema = z
  .object({
    type: incidentTypeSchema,
    severity: incidentSeveritySchema,
    occurredAt: z.coerce.date(),
    discoveredAt: z.coerce.date().optional(),
    facilityId: z.string().min(1).optional(),
    siteId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    permitId: z.string().min(1).optional(),
    description: z.string().min(10).max(4000),
    immediateAction: z.string().max(2000).optional(),
    affectedMedium: z.string().max(60).optional(),
    estimatedQuantity: z.number().min(0).optional(),
    quantityUnit: z.string().max(30).optional(),
    // Left unset, this is derived from type and severity so a major incident
    // cannot be logged with notification quietly switched off.
    regulatorNotifiable: z.boolean().optional(),
    ownerUserId: z.string().min(1).optional(),
  })
  .refine((v) => !v.discoveredAt || v.discoveredAt >= v.occurredAt, {
    message: "An incident cannot be discovered before it occurred.",
    path: ["discoveredAt"],
  })
  .refine((v) => v.occurredAt.getTime() <= Date.now() + 60_000, {
    message: "An incident cannot be recorded as occurring in the future.",
    path: ["occurredAt"],
  });

export const updateIncidentSchema = z.object({
  type: incidentTypeSchema.optional(),
  severity: incidentSeveritySchema.optional(),
  status: incidentStatusSchema.optional(),
  discoveredAt: z.coerce.date().nullable().optional(),
  description: z.string().min(10).max(4000).optional(),
  immediateAction: z.string().max(2000).nullable().optional(),
  rootCause: z.string().max(4000).nullable().optional(),
  affectedMedium: z.string().max(60).nullable().optional(),
  estimatedQuantity: z.number().min(0).nullable().optional(),
  quantityUnit: z.string().max(30).nullable().optional(),
  regulatorNotifiable: z.boolean().optional(),
  regulatorNotifiedAt: z.coerce.date().nullable().optional(),
  regulatorReference: z.string().max(120).nullable().optional(),
  ownerUserId: z.string().min(1).nullable().optional(),
});

// ─── Corrective actions ──────────────────────────────────────────────────────

export const actionTypeSchema = z.enum(["containment", "corrective", "preventive"]);

export const createCorrectiveActionSchema = z.object({
  type: actionTypeSchema,
  description: z.string().min(5).max(2000),
  assignedToUserId: z.string().min(1).optional(),
  dueOn: z.coerce.date().optional(),
});

export const updateCorrectiveActionSchema = z.object({
  type: actionTypeSchema.optional(),
  description: z.string().min(5).max(2000).optional(),
  status: z
    .enum(["open", "in_progress", "awaiting_verification", "verified", "overdue", "cancelled"])
    .optional(),
  assignedToUserId: z.string().min(1).nullable().optional(),
  dueOn: z.coerce.date().nullable().optional(),
  verificationNote: z.string().max(2000).optional(),
});

// ─── Aspects ─────────────────────────────────────────────────────────────────

export const createAspectSchema = z.object({
  facilityId: z.string().min(1).optional(),
  activity: z.string().min(1).max(300),
  aspect: z.string().min(1).max(300),
  impact: z.string().min(1).max(300),
  operatingCondition: z.enum(["normal", "abnormal", "emergency"]).default("normal"),
  severityScore: z.number().int().min(1).max(5).default(1),
  likelihoodScore: z.number().int().min(1).max(5).default(1),
  legalScore: z.number().int().min(1).max(5).default(1),
  existingControls: z.string().max(2000).optional(),
  furtherAction: z.string().max(2000).optional(),
  ownerUserId: z.string().min(1).optional(),
  lastReviewedOn: z.coerce.date().optional(),
  nextReviewOn: z.coerce.date().optional(),
});

export const updateAspectSchema = createAspectSchema.partial();
