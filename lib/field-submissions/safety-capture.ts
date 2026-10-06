import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { checklistItems } from "@/lib/management-systems/registers/server";
import { SocialValueApprovalError } from "@/lib/social-value/field-capture";

// Hazard reports and site inspections from the field app. Neither carries an
// emission category or quantity: approving a hazard report raises a
// corrective action (and, for a near miss, an H&S incident report so it
// counts in the incident figures); approving an inspection records it
// against its checklist, and any failed item raises a corrective action.

type TxClient = Prisma.TransactionClient;

export const HAZARD_KINDS = ["hazard", "near_miss", "unsafe_act", "unsafe_condition", "environmental"] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];
export const HAZARD_LABELS: Record<HazardKind, string> = {
  hazard: "Hazard",
  near_miss: "Near miss",
  unsafe_act: "Unsafe act",
  unsafe_condition: "Unsafe condition",
  environmental: "Environmental concern",
};

export type HazardEntry = { kind: HazardKind; description: string; location: string | null; immediateAction: string | null; observedOn: string | null };
export type InspectionEntry = {
  templateId: string;
  location: string;
  inspectedOn: string | null;
  results: Array<{ item: string; result: "pass" | "fail" | "na"; note?: string }>;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function hazardEntry(formData: Record<string, unknown>): { entry: HazardEntry } | { error: string } {
  const kind = formData.kind;
  if (!HAZARD_KINDS.includes(kind as HazardKind)) return { error: "Choose what was seen: hazard, near miss, unsafe act, unsafe condition or environmental concern." };
  const description = text(formData.description, 2000);
  if (!description) return { error: "Describe what was seen." };
  const observedOn = typeof formData.observedOn === "string" && DATE.test(formData.observedOn) ? formData.observedOn : null;
  return { entry: { kind: kind as HazardKind, description, location: text(formData.location, 300), immediateAction: text(formData.immediateAction, 2000), observedOn } };
}

export function inspectionEntry(formData: Record<string, unknown>): { entry: InspectionEntry } | { error: string } {
  const templateId = text(formData.templateId, 64);
  if (!templateId) return { error: "Choose the checklist this inspection used." };
  const location = text(formData.location, 300);
  if (!location) return { error: "Say where the inspection took place." };
  let raw = formData.results;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw) || !raw.length || raw.length > 200) return { error: "Record a result for at least one checklist item." };
  const results: InspectionEntry["results"] = [];
  for (const r of raw) {
    const item = text((r as Record<string, unknown>)?.item, 300);
    const result = (r as Record<string, unknown>)?.result;
    if (!item || !["pass", "fail", "na"].includes(result as string)) return { error: "Each checklist result needs its item and pass, fail or N/A." };
    const note = text((r as Record<string, unknown>).note, 1000);
    results.push({ item, result: result as "pass" | "fail" | "na", ...(note ? { note } : {}) });
  }
  const inspectedOn = typeof formData.inspectedOn === "string" && DATE.test(formData.inspectedOn) ? formData.inspectedOn : null;
  return { entry: { templateId, location, inspectedOn, results } };
}

/** Submission-time check: the checklist is the organisation's and every result is one of its items. */
export async function safetySubmissionError(orgId: string, documentType: string, formData: Record<string, unknown>): Promise<string | null> {
  if (documentType === "hazard_report") {
    const parsed = hazardEntry(formData);
    return "error" in parsed ? parsed.error : null;
  }
  if (documentType === "site_inspection") {
    const parsed = inspectionEntry(formData);
    if ("error" in parsed) return parsed.error;
    const template = await prisma.msInspectionTemplate.findFirst({ where: { id: parsed.entry.templateId, organizationId: orgId }, select: { items: true } });
    if (!template) return "That checklist was not found.";
    const items = new Set(checklistItems(template.items));
    const unknown = parsed.entry.results.find((r) => !items.has(r.item));
    return unknown ? `"${unknown.item}" is not on the checklist.` : null;
  }
  return null;
}

/** Extends the social value error so every approval path that turns form-data problems into a 422 handles it too. */
export class SafetyApprovalError extends SocialValueApprovalError {}

type Submission = { id: string; formData: Prisma.JsonValue; siteId: string | null; facilityId: string | null; submittedByUserId: string; deviceSubmittedAt: Date | null; createdAt: Date };

/** Approving a hazard report: a corrective action to deal with it, and for a near miss an H&S incident report. */
export async function approveHazardInTx(tx: TxClient, opts: { orgId: string; submission: Submission; reviewerUserId: string }) {
  const parsed = hazardEntry((opts.submission.formData ?? {}) as Record<string, unknown>);
  if ("error" in parsed) throw new SafetyApprovalError(parsed.error);
  const { entry } = parsed;
  const when = entry.observedOn ? new Date(`${entry.observedOn}T12:00:00Z`) : (opts.submission.deviceSubmittedAt ?? opts.submission.createdAt);
  const ref = `FS-${opts.submission.id.slice(-8).toUpperCase()}`;

  let incidentId: string | null = null;
  if (entry.kind === "near_miss") {
    const existing = await tx.hsIncidentReport.findFirst({ where: { organizationId: opts.orgId, fieldSubmissionId: opts.submission.id }, select: { id: true } });
    incidentId =
      existing?.id ??
      (
        await tx.hsIncidentReport.create({
          data: {
            organizationId: opts.orgId,
            reference: ref,
            incidentType: "near_miss",
            occurredAt: when,
            siteId: opts.submission.siteId,
            facilityId: opts.submission.facilityId,
            fieldSubmissionId: opts.submission.id,
            title: entry.description.slice(0, 120),
            description: [entry.description, entry.location ? `Location: ${entry.location}` : null].filter(Boolean).join("\n\n"),
            immediateAction: entry.immediateAction,
            reportedByUserId: opts.submission.submittedByUserId,
            createdByUserId: opts.reviewerUserId,
          },
          select: { id: true },
        })
      ).id;
  }

  const ca = await tx.msCorrectiveAction.create({
    data: {
      organizationId: opts.orgId,
      title: `${HAZARD_LABELS[entry.kind]} reported on site: ${entry.description.slice(0, 120)}`,
      source: "incident",
      sourceReference: ref,
      description: [entry.description, entry.location ? `Location: ${entry.location}` : null, entry.immediateAction ? `Immediate action taken: ${entry.immediateAction}` : null].filter(Boolean).join("\n\n"),
      createdByUserId: opts.reviewerUserId,
    },
    select: { id: true },
  });
  return { correctiveActionId: ca.id, incidentId };
}

/** Approving an inspection: recorded against its checklist; failed items raise one corrective action. */
export async function approveInspectionInTx(tx: TxClient, opts: { orgId: string; submission: Submission; reviewerUserId: string }) {
  const parsed = inspectionEntry((opts.submission.formData ?? {}) as Record<string, unknown>);
  if ("error" in parsed) throw new SafetyApprovalError(parsed.error);
  const { entry } = parsed;
  const template = await tx.msInspectionTemplate.findFirst({ where: { id: entry.templateId, organizationId: opts.orgId }, select: { id: true, items: true } });
  if (!template) throw new SafetyApprovalError("The checklist this inspection used no longer exists.");
  const items = new Set(checklistItems(template.items));
  if (entry.results.some((r) => !items.has(r.item))) throw new SafetyApprovalError("The checklist has changed since this inspection; some items are no longer on it.");

  const inspectedOn = entry.inspectedOn ? new Date(`${entry.inspectedOn}T00:00:00Z`) : (opts.submission.deviceSubmittedAt ?? opts.submission.createdAt);
  const failed = entry.results.filter((r) => r.result === "fail");
  let correctiveActionId: string | null = null;
  if (failed.length) {
    const ca = await tx.msCorrectiveAction.create({
      data: {
        organizationId: opts.orgId,
        title: `Inspection at ${entry.location}: ${failed.length} item${failed.length === 1 ? "" : "s"} failed`,
        source: "inspection",
        sourceReference: inspectedOn.toISOString().slice(0, 10),
        description: failed.map((f) => `- ${f.item}${f.note ? `: ${f.note}` : ""}`).join("\n"),
        createdByUserId: opts.reviewerUserId,
      },
      select: { id: true },
    });
    correctiveActionId = ca.id;
  }
  const inspection = await tx.msInspection.create({
    data: {
      organizationId: opts.orgId,
      templateId: template.id,
      location: entry.location,
      inspectedOn,
      inspectorUserId: opts.submission.submittedByUserId,
      results: entry.results,
      status: failed.length ? "actions_open" : "completed",
      notes: `From the field app (submission ${opts.submission.id}).`,
      correctiveActionId,
      createdByUserId: opts.reviewerUserId,
    },
    select: { id: true },
  });
  return { inspectionId: inspection.id, correctiveActionId };
}

export const NO_CATEGORY_TYPES = new Set(["social_value", "hazard_report", "site_inspection", "fuel_log", "water_meter_reading"]);
export const SAFETY_TYPES = new Set(["hazard_report", "site_inspection"]);
