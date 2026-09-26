import type { MsEvidenceKind } from "@prisma/client";
import { prisma } from "@/lib/db";

// Evidence a requirement can point at. Record kinds are the organisation's
// own rows: the target is looked up with the organisation in the WHERE clause
// before a link is made, so a link can never name another tenant's record.

export const RECORD_KINDS = [
  "evidence_file",
  "legal_register_entry",
  "environmental_aspect",
  "environmental_permit",
  "environmental_incident",
  "hs_incident_report",
  "method_statement",
  "reduction_target",
] as const satisfies readonly MsEvidenceKind[];

export type RecordKind = (typeof RECORD_KINDS)[number];

export const KIND_LABELS: Record<MsEvidenceKind, string> = {
  evidence_file: "Evidence file",
  legal_register_entry: "Legal register entry",
  environmental_aspect: "Environmental aspect",
  environmental_permit: "Permit",
  environmental_incident: "Environmental incident",
  hs_incident_report: "H&S incident",
  method_statement: "Method statement",
  reduction_target: "Reduction target",
  url: "Link",
  note: "Note",
};

type Option = { id: string; label: string };

type KindSpec = {
  /** Records of this kind in the organisation matching the search, newest first. */
  search: (orgId: string, q: string) => Promise<Option[]>;
  /** The record's label, or null when it is not the organisation's. */
  find: (orgId: string, id: string) => Promise<string | null>;
  href: (orgId: string, id: string) => string;
};

const TAKE = 20;
const contains = (q: string) => (q ? { contains: q, mode: "insensitive" as const } : undefined);

const SPECS: Record<RecordKind, KindSpec> = {
  evidence_file: {
    search: (orgId, q) =>
      prisma.evidenceFile
        .findMany({ where: { organizationId: orgId, filename: contains(q) }, select: { id: true, filename: true }, orderBy: { createdAt: "desc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: r.filename }))),
    find: (orgId, id) => prisma.evidenceFile.findFirst({ where: { id, organizationId: orgId }, select: { filename: true } }).then((r) => r?.filename ?? null),
    href: (orgId, id) => `/api/orgs/${orgId}/evidence/${id}/download`,
  },
  legal_register_entry: {
    search: (orgId, q) =>
      prisma.legalRegisterEntry
        .findMany({ where: { organizationId: orgId, title: contains(q) }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: r.title }))),
    find: (orgId, id) => prisma.legalRegisterEntry.findFirst({ where: { id, organizationId: orgId }, select: { title: true } }).then((r) => r?.title ?? null),
    href: (orgId) => `/orgs/${orgId}/environment/legal-register`,
  },
  environmental_aspect: {
    search: (orgId, q) =>
      prisma.environmentalAspect
        .findMany({
          where: { organizationId: orgId, ...(q ? { OR: [{ aspect: contains(q) }, { activity: contains(q) }] } : {}) },
          select: { id: true, aspect: true, activity: true },
          orderBy: { significanceScore: "desc" },
          take: TAKE,
        })
        .then((rows) => rows.map((r) => ({ id: r.id, label: `${r.aspect} (${r.activity})` }))),
    find: (orgId, id) =>
      prisma.environmentalAspect.findFirst({ where: { id, organizationId: orgId }, select: { aspect: true, activity: true } }).then((r) => (r ? `${r.aspect} (${r.activity})` : null)),
    href: (orgId) => `/orgs/${orgId}/environment/aspects`,
  },
  environmental_permit: {
    search: (orgId, q) =>
      prisma.environmentalPermit
        .findMany({ where: { organizationId: orgId, ...(q ? { OR: [{ title: contains(q) }, { reference: contains(q) }] } : {}) }, select: { id: true, title: true, reference: true }, orderBy: { title: "asc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: `${r.title} (${r.reference})` }))),
    find: (orgId, id) =>
      prisma.environmentalPermit.findFirst({ where: { id, organizationId: orgId }, select: { title: true, reference: true } }).then((r) => (r ? `${r.title} (${r.reference})` : null)),
    href: (orgId) => `/orgs/${orgId}/environment/permits`,
  },
  environmental_incident: {
    search: (orgId, q) =>
      prisma.environmentalIncident
        .findMany({ where: { organizationId: orgId, ...(q ? { OR: [{ title: contains(q) }, { reference: contains(q) }] } : {}) }, select: { id: true, title: true, reference: true }, orderBy: { occurredAt: "desc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: r.title ? `${r.reference}: ${r.title}` : r.reference }))),
    find: (orgId, id) =>
      prisma.environmentalIncident
        .findFirst({ where: { id, organizationId: orgId }, select: { title: true, reference: true } })
        .then((r) => (r ? (r.title ? `${r.reference}: ${r.title}` : r.reference) : null)),
    href: (orgId) => `/orgs/${orgId}/environment/incidents`,
  },
  hs_incident_report: {
    search: (orgId, q) =>
      prisma.hsIncidentReport
        .findMany({ where: { organizationId: orgId, ...(q ? { OR: [{ title: contains(q) }, { reference: contains(q) }] } : {}) }, select: { id: true, title: true, reference: true }, orderBy: { occurredAt: "desc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: r.title ? `${r.reference}: ${r.title}` : r.reference }))),
    find: (orgId, id) =>
      prisma.hsIncidentReport
        .findFirst({ where: { id, organizationId: orgId }, select: { title: true, reference: true } })
        .then((r) => (r ? (r.title ? `${r.reference}: ${r.title}` : r.reference) : null)),
    href: (orgId, id) => `/orgs/${orgId}/hs-incident-reports/${id}`,
  },
  method_statement: {
    search: (orgId, q) =>
      prisma.methodStatement
        .findMany({ where: { organizationId: orgId, title: contains(q) }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: TAKE })
        .then((rows) => rows.map((r) => ({ id: r.id, label: r.title }))),
    find: (orgId, id) => prisma.methodStatement.findFirst({ where: { id, organizationId: orgId }, select: { title: true } }).then((r) => r?.title ?? null),
    href: (orgId, id) => `/orgs/${orgId}/method-statements/${id}`,
  },
  reduction_target: {
    search: (orgId) =>
      prisma.reductionTarget
        .findMany({
          where: { organizationId: orgId },
          select: { id: true, reductionAmount: true, targetType: true, targetPeriod: { select: { label: true } } },
          orderBy: { createdAt: "desc" },
          take: TAKE,
        })
        .then((rows) => rows.map((r) => ({ id: r.id, label: targetLabel(r) }))),
    find: (orgId, id) =>
      prisma.reductionTarget
        .findFirst({ where: { id, organizationId: orgId }, select: { reductionAmount: true, targetType: true, targetPeriod: { select: { label: true } } } })
        .then((r) => (r ? targetLabel(r) : null)),
    href: (orgId) => `/orgs/${orgId}/targets`,
  },
};

function targetLabel(r: { reductionAmount: { toString(): string }; targetType: string; targetPeriod: { label: string } }) {
  return `${r.targetType.replaceAll("_", " ")} target ${r.reductionAmount.toString()} by ${r.targetPeriod.label}`;
}

export function isRecordKind(kind: string): kind is RecordKind {
  return (RECORD_KINDS as readonly string[]).includes(kind);
}

export function searchRecords(orgId: string, kind: RecordKind, q: string): Promise<Option[]> {
  return SPECS[kind].search(orgId, q.trim().slice(0, 100));
}

/** The record's label when it belongs to the organisation, else null. */
export function findRecordLabel(orgId: string, kind: RecordKind, id: string): Promise<string | null> {
  return SPECS[kind].find(orgId, id);
}

/** Where a link opens: the record's page, the evidence download, or the URL itself. */
export function evidenceHref(orgId: string, link: { kind: MsEvidenceKind; targetId: string | null; url: string | null }): string | null {
  if (link.kind === "url") return link.url;
  if (link.kind === "note" || !link.targetId || !isRecordKind(link.kind)) return null;
  return SPECS[link.kind].href(orgId, link.targetId);
}
