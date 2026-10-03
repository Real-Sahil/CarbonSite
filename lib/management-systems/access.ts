import type { OrgRole } from "@prisma/client";
import { z } from "zod";
import { ROLE_GROUPS } from "@/lib/auth/session";
import { REQUIREMENT_STATES } from "./readiness";

/** Who can see management system status: the inventory readers plus operations. Never field workers or suppliers. */
export const MS_READERS: OrgRole[] = [...ROLE_GROUPS.dataReaders, "operations_manager"];
/** Who can adopt frameworks, assess requirements and link evidence. */
export const MS_EDITORS: OrgRole[] = [...ROLE_GROUPS.editor, "operations_manager"];

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00Z`))
  .nullable()
  .optional();

export const adoptSchema = z.object({ frameworkSlug: z.string().min(1).max(80) });

export const adoptionUpdateSchema = z.object({
  status: z.enum(["implementing", "certified", "lapsed", "withdrawn"]).optional(),
  scope: z.string().max(2000).nullable().optional(),
  targetDate: optionalDate,
  certificationBody: z.string().max(200).nullable().optional(),
  certificateNumber: z.string().max(100).nullable().optional(),
  certifiedUntil: optionalDate,
  /** true: the caller signs off that they reviewed MetricOra's guidance; false withdraws the sign-off. */
  guidanceReviewed: z.boolean().optional(),
  guidanceReviewNote: z.string().max(2000).nullable().optional(),
});

export const requirementUpdateSchema = z
  .object({
    status: z.enum(REQUIREMENT_STATES).optional(),
    ownerUserId: z.string().min(1).nullable().optional(),
    dueOn: optionalDate,
    notes: z.string().max(5000).nullable().optional(),
    interpretation: z.string().max(10000).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, "Nothing to update");

/** Record kinds a requirement can link to: the organisation's records and every register. */
export const EVIDENCE_RECORD_KINDS = [
  "evidence_file",
  "legal_register_entry",
  "environmental_aspect",
  "environmental_permit",
  "environmental_incident",
  "hs_incident_report",
  "method_statement",
  "reduction_target",
  // One per register (registers/config.ts); registers.test.ts keeps this in step.
  "ms_risk",
  "ms_interested_party",
  "ms_policy",
  "ms_document",
  "ms_change",
  "ms_objective",
  "ms_competence",
  "ms_training_record",
  "ms_audit",
  "ms_audit_finding",
  "ms_inspection_template",
  "ms_inspection",
  "ms_corrective_action",
  "ms_complaint",
  "ms_nonconformity",
  "ms_supplier_evaluation",
  "ms_equipment",
  "ms_toolbox_talk",
  "ms_toolbox_delivery",
  "ms_fleet_vehicle",
  "ms_management_review",
] as const;

export const evidenceCreateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.enum(EVIDENCE_RECORD_KINDS),
    targetId: z.string().min(1).max(64),
    note: z.string().max(1000).optional(),
  }),
  z.object({
    kind: z.literal("url"),
    url: z.string().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Only http and https links"),
    label: z.string().min(1).max(200),
    note: z.string().max(1000).optional(),
  }),
  z.object({ kind: z.literal("note"), label: z.string().min(1).max(200), note: z.string().max(5000).optional() }),
]);
