import { prisma } from "@/lib/db";
import type { SignalKey } from "./signal-keys";

// Live figures from the organisation's own records, shown beside the
// requirements that name them. They inform the person assessing a clause;
// they never set its status, which stays a human judgement.

export type Signal = {
  key: SignalKey;
  label: string;
  /** One line, e.g. "14 entries, 2 past their review date". */
  summary: string;
  tone: "ok" | "attention" | "empty";
  href: string;
};

const DAY = 86_400_000;

type Loader = (orgId: string, now: Date) => Promise<Omit<Signal, "key">>;

/** Rows in a register, with how many are past a date field and still open. */
async function registerSignal(
  model: string,
  orgId: string,
  now: Date,
  opts: { label: string; register: string; dateField?: string; openStatuses?: string[]; lateWord?: string; noun: [string, string] },
): Promise<Omit<Signal, "key">> {
  const m = (prisma as unknown as Record<string, { count: (a: object) => Promise<number> }>)[model];
  const [total, late] = await Promise.all([
    m.count({ where: { organizationId: orgId } }),
    opts.dateField ? m.count({ where: { organizationId: orgId, [opts.dateField]: { lt: now }, ...(opts.openStatuses ? { status: { in: opts.openStatuses } } : {}) } }) : Promise.resolve(0),
  ]);
  return {
    label: opts.label,
    summary: total === 0 ? "None recorded yet" : `${plural(total, opts.noun[0], opts.noun[1])}${opts.dateField ? `, ${late} ${opts.lateWord ?? "overdue"}` : ""}`,
    tone: total === 0 ? "empty" : late > 0 ? "attention" : "ok",
    href: `management-systems/registers/${opts.register}`,
  };
}


const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const LOADERS: Record<SignalKey, Loader> = {
  async legal_register(orgId, now) {
    const [total, overdue, breaches] = await Promise.all([
      prisma.legalRegisterEntry.count({ where: { organizationId: orgId } }),
      prisma.legalRegisterEntry.count({ where: { organizationId: orgId, nextReviewOn: { lt: now } } }),
      prisma.legalRegisterEntry.count({ where: { organizationId: orgId, complianceStatus: { in: ["breach", "at_risk"] } } }),
    ]);
    return {
      label: "Legal register",
      summary: total === 0 ? "No entries yet" : `${plural(total, "entry", "entries")}, ${overdue} past review, ${breaches} at risk or in breach`,
      tone: total === 0 ? "empty" : overdue + breaches > 0 ? "attention" : "ok",
      href: "environment/legal-register",
    };
  },
  async environmental_aspects(orgId, now) {
    const [total, significant, overdue] = await Promise.all([
      prisma.environmentalAspect.count({ where: { organizationId: orgId } }),
      prisma.environmentalAspect.count({ where: { organizationId: orgId, significance: "significant" } }),
      prisma.environmentalAspect.count({ where: { organizationId: orgId, nextReviewOn: { lt: now } } }),
    ]);
    return {
      label: "Aspects register",
      summary: total === 0 ? "No aspects recorded" : `${plural(total, "aspect")}, ${significant} significant, ${overdue} past review`,
      tone: total === 0 ? "empty" : overdue > 0 ? "attention" : "ok",
      href: "environment/aspects",
    };
  },
  async environmental_permits(orgId, now) {
    const soon = new Date(now.getTime() + 90 * DAY);
    const [active, expiring, expired] = await Promise.all([
      prisma.environmentalPermit.count({ where: { organizationId: orgId, status: "active" } }),
      prisma.environmentalPermit.count({ where: { organizationId: orgId, status: "active", expiresOn: { gte: now, lte: soon } } }),
      prisma.environmentalPermit.count({ where: { organizationId: orgId, OR: [{ status: "expired" }, { status: "active", expiresOn: { lt: now } }] } }),
    ]);
    return {
      label: "Permits",
      summary: active + expired === 0 ? "No permits recorded" : `${active} active, ${expiring} expiring within 90 days, ${expired} expired`,
      tone: active + expired === 0 ? "empty" : expired + expiring > 0 ? "attention" : "ok",
      href: "environment/permits",
    };
  },
  async environmental_incidents(orgId, now) {
    const since = new Date(now.getTime() - 365 * DAY);
    const [year, open] = await Promise.all([
      prisma.environmentalIncident.count({ where: { organizationId: orgId, occurredAt: { gte: since } } }),
      prisma.environmentalIncident.count({ where: { organizationId: orgId, status: { not: "closed" } } }),
    ]);
    return {
      label: "Environmental incidents",
      summary: `${year} in the last 12 months, ${open} not closed`,
      tone: open > 0 ? "attention" : "ok",
      href: "environment/incidents",
    };
  },
  async hs_incidents(orgId, now) {
    const since = new Date(now.getTime() - 365 * DAY);
    const [year, open, riddor] = await Promise.all([
      prisma.hsIncidentReport.count({ where: { organizationId: orgId, occurredAt: { gte: since } } }),
      prisma.hsIncidentReport.count({ where: { organizationId: orgId, status: { not: "closed" } } }),
      prisma.hsIncidentReport.count({ where: { organizationId: orgId, occurredAt: { gte: since }, riddorReportable: true } }),
    ]);
    return {
      label: "H&S incidents",
      summary: `${year} in the last 12 months (${riddor} RIDDOR), ${open} not closed`,
      tone: open > 0 ? "attention" : "ok",
      href: "hs-incident-reports",
    };
  },
  async method_statements(orgId) {
    const [approved, total] = await Promise.all([
      prisma.methodStatement.count({ where: { organizationId: orgId, status: { in: ["approved", "issued", "signed_off"] } } }),
      prisma.methodStatement.count({ where: { organizationId: orgId, status: { not: "superseded" } } }),
    ]);
    return {
      label: "Method statements",
      summary: total === 0 ? "None written yet" : `${approved} of ${total} approved or issued`,
      tone: total === 0 ? "empty" : approved < total ? "attention" : "ok",
      href: "method-statements",
    };
  },
  async reduction_targets(orgId) {
    const total = await prisma.reductionTarget.count({ where: { organizationId: orgId } });
    return {
      label: "Targets",
      summary: total === 0 ? "No targets set" : plural(total, "reduction target"),
      tone: total === 0 ? "empty" : "ok",
      href: "targets",
    };
  },
  async emissions_monitoring(orgId) {
    const latest = await prisma.publishedSnapshot.findFirst({
      where: { organizationId: orgId },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true, reportingPeriod: { select: { label: true } } },
    });
    return {
      label: "Emissions inventory",
      summary: latest ? `Latest published: ${latest.reportingPeriod.label}` : "Nothing published yet",
      tone: latest ? "ok" : "empty",
      href: "snapshots",
    };
  },
  async waste_water_monitoring(orgId, now) {
    const since = new Date(now.getTime() - 365 * DAY);
    const [waste, water] = await Promise.all([
      prisma.wasteRecord.count({ where: { organizationId: orgId, recordedAt: { gte: since } } }),
      prisma.waterRecord.count({ where: { organizationId: orgId, recordedAt: { gte: since } } }),
    ]);
    return {
      label: "Waste and water",
      summary: `${plural(waste, "waste record")} and ${plural(water, "water record")} in the last 12 months`,
      tone: waste + water === 0 ? "empty" : "ok",
      href: "waste",
    };
  },
  async suppliers(orgId, now) {
    const [total, isoLapsed] = await Promise.all([
      prisma.supplierProfile.count({ where: { organizationId: orgId } }),
      prisma.supplierProfile.count({
        where: { organizationId: orgId, OR: [{ iso14001ExpiresAt: { lt: now } }, { iso45001ExpiresAt: { lt: now } }] },
      }),
    ]);
    return {
      label: "Suppliers",
      summary: total === 0 ? "No suppliers recorded" : `${plural(total, "supplier")}, ${isoLapsed} with a lapsed ISO 14001 or 45001 certificate`,
      tone: total === 0 ? "empty" : isoLapsed > 0 ? "attention" : "ok",
      href: "suppliers",
    };
  },
  async evidence_files(orgId) {
    const total = await prisma.evidenceFile.count({ where: { organizationId: orgId } });
    return { label: "Evidence files", summary: plural(total, "file"), tone: total === 0 ? "empty" : "ok", href: "records" };
  },
  async members(orgId) {
    const total = await prisma.organizationMembership.count({
      where: { organizationId: orgId, role: { notIn: ["field_worker", "supplier"] } },
    });
    return { label: "Team", summary: plural(total, "member"), tone: "ok", href: "settings/members" };
  },
  async audit_log(orgId, now) {
    const since = new Date(now.getTime() - 30 * DAY);
    const total = await prisma.auditLog.count({ where: { organizationId: orgId, createdAt: { gte: since } } });
    return { label: "Audit log", summary: `${plural(total, "event")} in the last 30 days`, tone: "ok", href: "settings/audit" };
  },
  ms_policies: (o, n) => registerSignal("msPolicy", o, n, { label: "Policies", register: "policies", dateField: "reviewOn", openStatuses: ["draft", "approved"], lateWord: "past review", noun: ["policy", "policies"] }),
  ms_documents: (o, n) => registerSignal("msDocument", o, n, { label: "Controlled documents", register: "documents", dateField: "reviewOn", openStatuses: ["draft", "approved"], lateWord: "past review", noun: ["document", "documents"] }),
  ms_training: (o, n) => registerSignal("msTrainingRecord", o, n, { label: "Training records", register: "training-records", dateField: "expiresOn", lateWord: "expired", noun: ["record", "records"] }),
  ms_risks: (o, n) => registerSignal("msRisk", o, n, { label: "Risks and opportunities", register: "risks", dateField: "reviewOn", openStatuses: ["open", "treated", "accepted"], lateWord: "past review", noun: ["entry", "entries"] }),
  ms_objectives: (o, n) => registerSignal("msObjective", o, n, { label: "Objectives", register: "objectives", dateField: "targetDate", openStatuses: ["on_track", "at_risk", "off_track"], lateWord: "past their target date", noun: ["objective", "objectives"] }),
  ms_changes: (o, n) => registerSignal("msChange", o, n, { label: "Planned changes", register: "changes", dateField: "plannedOn", openStatuses: ["proposed", "approved"], noun: ["change", "changes"] }),
  ms_audits: (o, n) => registerSignal("msAudit", o, n, { label: "Internal audits", register: "audits", dateField: "plannedOn", openStatuses: ["planned", "in_progress"], noun: ["audit", "audits"] }),
  ms_management_reviews: (o, n) => registerSignal("msManagementReview", o, n, { label: "Management reviews", register: "management-reviews", dateField: "heldOn", openStatuses: ["planned"], noun: ["review", "reviews"] }),
  ms_corrective_actions: (o, n) => registerSignal("msCorrectiveAction", o, n, { label: "Corrective actions", register: "corrective-actions", dateField: "dueOn", openStatuses: ["open", "in_progress", "awaiting_verification"], noun: ["action", "actions"] }),
  ms_complaints: (o, n) => registerSignal("msComplaint", o, n, { label: "Complaints", register: "complaints", noun: ["complaint", "complaints"] }),
  ms_equipment: (o, n) => registerSignal("msEquipment", o, n, { label: "Equipment checks", register: "equipment", dateField: "nextDueOn", openStatuses: ["in_service"], noun: ["item", "items"] }),
  ms_supplier_evaluations: (o, n) => registerSignal("msSupplierEvaluation", o, n, { label: "Supplier evaluations", register: "supplier-evaluations", noun: ["evaluation", "evaluations"] }),
  ms_inspections: (o, n) => registerSignal("msInspection", o, n, { label: "Inspections", register: "inspections", noun: ["inspection", "inspections"] }),
};



/** The named signals for an organisation. A loader that fails is left out, never guessed. */
export async function loadSignals(orgId: string, keys: Iterable<SignalKey>, now = new Date()): Promise<Map<SignalKey, Signal>> {
  const unique = [...new Set(keys)];
  const results = await Promise.all(
    unique.map((key) =>
      LOADERS[key](orgId, now)
        .then((s): Signal => ({ key, ...s, href: `/orgs/${orgId}/${s.href}` }))
        .catch(() => null),
    ),
  );
  return new Map(results.flatMap((s) => (s ? [[s.key, s] as const] : [])));
}
