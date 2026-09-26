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
  audits: "msAudit",
  "audit-findings": "msAuditFinding",
  "corrective-actions": "msCorrectiveAction",
  "management-reviews": "msManagementReview",
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
    case "member":
    case "audit":
      return z.string().min(1).max(64);
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
    if (f.type === "member") users[f.name as `${string}UserId`] = v;
    if (f.type === "audit") {
      const audit = await prisma.msAudit.findFirst({ where: { id: v, organizationId: orgId }, select: { id: true } });
      if (!audit) return "Audit not found in this organisation.";
    }
  }
  return Object.keys(users).length ? orgRefsMessage(orgId, users) : null;
}

/**
 * Rules the standards imply, applied on update: editing an approved policy
 * starts a new draft version; approving one records who and when; a
 * corrective action can only close with a note on its effectiveness.
 */
export function applyRules(key: RegisterKey, existing: Row, body: Record<string, unknown>, userId: string): { data: Record<string, unknown>; error?: string } {
  const data = { ...body };
  if (key === "policies") {
    const contentChanged = ["title", "body"].some((k) => k in body && body[k] !== existing[k]);
    if (existing.status === "approved" && contentChanged && body.status !== "retired") {
      data.status = "draft";
      data.version = (existing.version as number) + 1;
      data.approvedByUserId = null;
      data.approvedOn = null;
    } else if (body.status === "approved" && existing.status !== "approved") {
      data.approvedByUserId = userId;
      data.approvedOn = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
    }
  }
  if (key === "corrective-actions" && body.status === "closed") {
    const effectiveness = "effectiveness" in body ? body.effectiveness : existing.effectiveness;
    if (typeof effectiveness !== "string" || !effectiveness.trim()) return { data, error: "Record whether the action worked before closing it." };
  }
  return { data };
}

/** Create-time version of the corrective action rule. */
export function createRuleError(key: RegisterKey, body: Record<string, unknown>): string | null {
  if (key === "corrective-actions" && body.status === "closed" && !(typeof body.effectiveness === "string" && body.effectiveness.trim())) {
    return "Record whether the action worked before closing it.";
  }
  return null;
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
