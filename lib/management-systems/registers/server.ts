import { z } from "zod";
import { prisma } from "@/lib/db";
import { orgRefsMessage } from "@/lib/security/org-refs";
import { getFramework } from "../catalogue";
import { REGISTERS, type Field, type RegisterKey } from "./config";

// Generic create, update and read for the registers in config.ts. Every row
// is read and written with the organisation in the WHERE clause; every id a
// request names (members, audits) is checked against the organisation first.

type Row = Record<string, unknown> & { id: string };
type Delegate = {
  findMany: (args: object) => Promise<Row[]>;
  findFirst: (args: object) => Promise<Row | null>;
  create: (args: object) => Promise<Row>;
  update: (args: object) => Promise<Row>;
  delete: (args: object) => Promise<Row>;
};

const MODELS: Record<RegisterKey, string> = {
  risks: "msRisk",
  "interested-parties": "msInterestedParty",
  policies: "msPolicy",
  documents: "msDocument",
  changes: "msChange",
  objectives: "msObjective",
  competences: "msCompetence",
  "training-records": "msTrainingRecord",
  audits: "msAudit",
  "audit-findings": "msAuditFinding",
  "inspection-templates": "msInspectionTemplate",
  inspections: "msInspection",
  "corrective-actions": "msCorrectiveAction",
  complaints: "msComplaint",
  nonconformities: "msNonconformity",
  "supplier-evaluations": "msSupplierEvaluation",
  equipment: "msEquipment",
  "management-reviews": "msManagementReview",
};

/** Database table of each register, for the one-statement counts below. */
const TABLES: Record<RegisterKey, string> = {
  risks: "ms_risks",
  "interested-parties": "ms_interested_parties",
  policies: "ms_policies",
  documents: "ms_documents",
  changes: "ms_changes",
  objectives: "ms_objectives",
  competences: "ms_competences",
  "training-records": "ms_training_records",
  audits: "ms_audits",
  "audit-findings": "ms_audit_findings",
  "inspection-templates": "ms_inspection_templates",
  inspections: "ms_inspections",
  "corrective-actions": "ms_corrective_actions",
  complaints: "ms_complaints",
  nonconformities: "ms_nonconformities",
  "supplier-evaluations": "ms_supplier_evaluations",
  equipment: "ms_equipment",
  "management-reviews": "ms_management_reviews",
};

/**
 * Rows per register for the organisation in one statement (Prisma has one
 * connection per function, so eighteen counts would be eighteen round trips).
 * Table names come from the constant above, never from the request.
 */
export async function registerCounts(orgId: string): Promise<Record<RegisterKey, number>> {
  const sql = (Object.entries(TABLES) as Array<[RegisterKey, string]>)
    .map(([key, table]) => `SELECT '${key}' AS key, count(*)::int AS n FROM "${table}" WHERE organization_id = $1`)
    .join(" UNION ALL ");
  const rows = await prisma.$queryRawUnsafe<Array<{ key: RegisterKey; n: number }>>(sql, orgId);
  return Object.fromEntries(rows.map((r) => [r.key, r.n])) as Record<RegisterKey, number>;
}

/** Registers whose rows other registers point at: a row still referenced cannot be deleted. */
export const REFERENCED_BY: Partial<Record<RegisterKey, Array<{ key: RegisterKey; field: string }>>> = {
  competences: [{ key: "training-records", field: "competenceId" }],
  "inspection-templates": [{ key: "inspections", field: "templateId" }],
};

export function delegate(key: RegisterKey): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[MODELS[key]];
}

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .transform((s) => new Date(`${s}T00:00:00Z`));

function fieldSchema(f: Field): z.ZodTypeAny {
  switch (f.type) {
    case "text":
      return z.string().trim().min(1).max(300);
    case "textarea":
      return z.string().trim().min(1).max(20000);
    case "select":
      return z.enum(f.options!.map(([v]) => v) as [string, ...string[]]);
    case "date":
      return date;
    case "score":
      return z.number().int().min(1).max(5);
    case "number":
      return z.number().finite().min(-1e12).max(1e12);
    case "member":
    case "person":
    case "row":
    case "file":
      return z.string().min(1).max(64);
    case "checklist":
      return z
        .array(z.object({ item: z.string().trim().min(1).max(300), result: z.enum(["pass", "fail", "na"]), note: z.string().trim().max(1000).optional() }).strict())
        .max(200);
    case "boolean":
      return z.boolean();
    case "frameworks":
      return z
        .array(z.string().max(80))
        .max(30)
        .refine((slugs) => slugs.every((s) => getFramework(s)), "Unknown framework");
  }
}

/** Zod schema for a create (required fields required) or an update (all optional). */
export function registerSchema(key: RegisterKey, mode: "create" | "update") {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of REGISTERS[key].fields) {
    const s = fieldSchema(f);
    shape[f.name] = mode === "create" && f.required ? s : f.required ? s.optional() : s.nullable().optional();
  }
  const obj = z.object(shape).strict();
  return mode === "update" ? obj.refine((b) => Object.keys(b).length > 0, "Nothing to update") : obj;
}

/** The first id in the body that is not the organisation's, as a message, or null. */
export async function registerRefsMessage(orgId: string, key: RegisterKey, body: Record<string, unknown>): Promise<string | null> {
  const users: Record<`${string}UserId`, string | null> = {};
  for (const f of REGISTERS[key].fields) {
    const v = body[f.name];
    if (typeof v !== "string") continue;
    if (f.type === "member" || f.type === "person") users[f.name as `${string}UserId`] = v;
    if (f.type === "row" && f.ref) {
      const row = await delegate(f.ref).findFirst({ where: { id: v, organizationId: orgId }, select: { id: true } });
      if (!row) return `${REGISTERS[f.ref].singular[0].toUpperCase()}${REGISTERS[f.ref].singular.slice(1)} not found in this organisation.`;
    }
    if (f.type === "file") {
      const file = await prisma.evidenceFile.findFirst({ where: { id: v, organizationId: orgId }, select: { id: true } });
      if (!file) return "Evidence file not found in this organisation.";
    }
  }
  return Object.keys(users).length ? orgRefsMessage(orgId, users) : null;
}

/** A checklist's items: one per non-empty line. */
export function checklistItems(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.replace(/^\s*(?:[-*\u2022]|\d+[.)])\s*/, "").trim()).filter(Boolean))].slice(0, 200);
}

const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const addMonths = (d: Date, months: number) => {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
};

/**
 * Values worked out from other rows before a write: a training record's
 * person name and expiry, and equipment's next due date. Returns an error
 * message when the row cannot be saved.
 */
export async function enrich(orgId: string, key: RegisterKey, data: Record<string, unknown>, existing?: Row): Promise<string | null> {
  const merged = { ...(existing ?? {}), ...data };
  if (key === "training-records") {
    if (data.personUserId && !data.personName) {
      const user = await prisma.user.findFirst({ where: { id: String(data.personUserId), memberships: { some: { organizationId: orgId } } }, select: { name: true, email: true } });
      if (user) data.personName = user.name || user.email;
    }
    if (!(data.personName ?? existing?.personName)) return "Choose a user or type the person's name.";
    if (("completedOn" in data || "competenceId" in data) && !("expiresOn" in data && data.expiresOn) && merged.completedOn instanceof Date) {
      const comp = await prisma.msCompetence.findFirst({ where: { id: String(merged.competenceId), organizationId: orgId }, select: { validityMonths: true } });
      if (comp?.validityMonths && !existing?.expiresOn) data.expiresOn = addMonths(merged.completedOn, comp.validityMonths);
    }
  }
  if (key === "equipment" && ("lastCheckedOn" in data || "intervalMonths" in data) && !data.nextDueOn) {
    if (merged.lastCheckedOn instanceof Date && typeof merged.intervalMonths === "number" && merged.intervalMonths > 0) {
      data.nextDueOn = addMonths(merged.lastCheckedOn, merged.intervalMonths);
    }
  }
  if (key === "inspections" && Array.isArray(data.results)) {
    const template = await prisma.msInspectionTemplate.findFirst({ where: { id: String(merged.templateId), organizationId: orgId }, select: { items: true } });
    const items = new Set(checklistItems(template?.items ?? ""));
    const unknown = (data.results as Array<{ item: string }>).find((r) => !items.has(r.item));
    if (unknown) return `"${unknown.item}" is not on the chosen checklist.`;
  }
  if (key === "inspections" && Array.isArray(data.results) && data.results.some((r: { result: string }) => r.result === "fail") && !data.status) {
    data.status = "actions_open";
  }
  return null;
}

/**
 * Rules the standards imply, applied on update: editing an approved policy
 * starts a new draft version; approving one records who and when; a
 * corrective action can only close with a note on its effectiveness.
 */
export function applyRules(key: RegisterKey, existing: Row, body: Record<string, unknown>, userId: string): { data: Record<string, unknown>; error?: string } {
  const data = { ...body };
  if (key === "policies" || key === "documents") {
    const retire = key === "policies" ? "retired" : "withdrawn";
    const contentChanged = ["title", "body", "fileId"].some((k) => k in body && body[k] !== existing[k]);
    if (existing.status === "approved" && contentChanged && body.status !== retire) {
      data.status = "draft";
      data.version = (existing.version as number) + 1;
      data.approvedByUserId = null;
      data.approvedOn = null;
    } else if (body.status === "approved" && existing.status !== "approved") {
      data.approvedByUserId = userId;
      data.approvedOn = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    }
  }
  if (key === "changes" && body.status === "approved" && existing.status !== "approved") data.approvedByUserId = userId;
  if (key === "corrective-actions" && body.status === "closed") {
    const effectiveness = "effectiveness" in body ? body.effectiveness : existing.effectiveness;
    if (typeof effectiveness !== "string" || !effectiveness.trim()) return { data, error: "Record whether the action worked before closing it." };
  }
  return { data };
}

/** Fields set on create from who made it: approval of a policy, document or change created as approved. */
export function createDefaults(key: RegisterKey, body: Record<string, unknown>, userId: string): Record<string, unknown> {
  if ((key === "policies" || key === "documents") && body.status === "approved") return { approvedByUserId: userId, approvedOn: today() };
  if (key === "changes" && body.status === "approved") return { approvedByUserId: userId };
  return {};
}

/** Create-time version of the corrective action rule. */
export function createRuleError(key: RegisterKey, body: Record<string, unknown>): string | null {
  if (key === "corrective-actions" && body.status === "closed" && !(typeof body.effectiveness === "string" && body.effectiveness.trim())) {
    return "Record whether the action worked before closing it.";
  }
  return null;
}

/**
 * After an inspection is saved with failed items and no corrective action
 * yet, raise one corrective action listing them and link it.
 */
export async function afterSave(orgId: string, key: RegisterKey, row: Row, userId: string): Promise<Row> {
  if (key !== "inspections" || row.correctiveActionId) return row;
  const failed = ((row.results as Array<{ item: string; result: string; note?: string }>) ?? []).filter((r) => r.result === "fail");
  if (!failed.length) return row;
  const ca = await prisma.msCorrectiveAction.create({
    data: {
      organizationId: orgId,
      title: `Inspection at ${String(row.location)}: ${failed.length} item${failed.length === 1 ? "" : "s"} failed`,
      source: "inspection",
      sourceReference: row.inspectedOn instanceof Date ? row.inspectedOn.toISOString().slice(0, 10) : null,
      description: failed.map((f) => `- ${f.item}${f.note ? `: ${f.note}` : ""}`).join("\n"),
      ownerUserId: (row.inspectorUserId as string | null) ?? null,
      createdByUserId: userId,
    },
  });
  return delegate("inspections").update({ where: { id: row.id }, data: { correctiveActionId: ca.id } });
}

/** Rows for the page and API, dates as YYYY-MM-DD. */
export function serialize(row: Row): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  return out;
}

export async function listRows(orgId: string, key: RegisterKey) {
  const rows = await delegate(key).findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map(serialize);
}

/** Label of a register row for an evidence link, or null when it is not the organisation's. */
export async function registerRowLabel(orgId: string, key: RegisterKey, id: string): Promise<string | null> {
  const row = await delegate(key).findFirst({ where: { id, organizationId: orgId } });
  if (!row) return null;
  const title = String(row[REGISTERS[key].titleField] ?? REGISTERS[key].singular);
  return title.length > 120 ? `${title.slice(0, 117)}...` : title;
}

/** Rows of a register as options for a "row" field: id and title, newest first. */
export async function refOptions(orgId: string, key: RegisterKey): Promise<Array<{ id: string; name: string }>> {
  const { titleField } = REGISTERS[key];
  const rows = await delegate(key).findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 500 });
  return rows.map((r) => ({ id: r.id, name: String(r[titleField] ?? "").slice(0, 120) || REGISTERS[key].singular }));
}
