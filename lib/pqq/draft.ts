import { prisma } from "@/lib/db";
import { getFramework } from "@/lib/management-systems/catalogue";
import { readiness, type RequirementState } from "@/lib/management-systems/readiness";
import { trainingMatrix } from "@/lib/management-systems/training";
import { computePeriodTotals } from "@/lib/inventory/base-year";
import { TOPICS, type DraftFn, type Topic } from "./topics";

// Suggested answers drafted from the organisation's own records. Every
// sentence states a fact the records hold (a policy's version and approval
// date, a certificate number, a count of incidents) and nothing else: no
// claims the records cannot back. The person answering edits and saves; a
// draft is never saved on its own.

export type PqqContext = {
  orgName: string;
  entities: Array<{ name: string; registrationNumber: string | null }>;
  certificates: Record<string, { status: string; certificateNumber: string | null; certificationBody: string | null; certifiedUntil: Date | null; percent: number | null }>;
  documents: Array<{ title: string; category: string | null; version: number; approvedOn: Date | null; reviewOn: Date | null; kind: "policy" | "document" }>;
  training: { people: number; records: number; expired: number; expiring: number; competences: string[]; cardHolders: number };
  incidents: { since: Date; total: number; riddor: number; lostTime: number; nearMiss: number };
  suppliers: { evaluated: number; approved: number; lastOn: Date | null };
  checks: { auditsCompleted: number; lastAuditOn: Date | null; lastReviewOn: Date | null; closedActions: number; inspections: number };
  records: { risks: number; methodStatements: number; legalRegister: number; aspects: number; permits: number };
  carbon: { period: string | null; totalT: number | null; crpPeriod: string | null; crpStatus: string | null; crpUrl: string | null };
  gdprAdopted: boolean;
};

const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : null);
const YEAR = 365 * 86_400_000;

export async function loadPqqContext(orgId: string, today = new Date()): Promise<PqqContext> {
  const since = new Date(today.getTime() - 3 * YEAR);
  const yearAgo = new Date(today.getTime() - YEAR);
  const [org, entities, adoptions, statuses, policies, documents, competences, trainingRecords, incidents, evaluations, audits, reviews, closedActions, inspections, risks, methodStatements, legal, aspects, permits, snapshot, crp] =
    await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.legalEntity.findMany({ where: { organizationId: orgId }, select: { name: true, registrationNumber: true } }),
      prisma.msFrameworkAdoption.findMany({ where: { organizationId: orgId, status: { not: "withdrawn" } } }),
      prisma.msRequirementStatus.findMany({ where: { organizationId: orgId }, select: { frameworkSlug: true, requirementCode: true, status: true } }),
      prisma.msPolicy.findMany({ where: { organizationId: orgId, status: "approved" }, select: { title: true, category: true, version: true, approvedOn: true, reviewOn: true } }),
      prisma.msDocument.findMany({ where: { organizationId: orgId, status: "approved" }, select: { title: true, docType: true, version: true, approvedOn: true, reviewOn: true } }),
      prisma.msCompetence.findMany({ where: { organizationId: orgId }, select: { id: true, title: true, validityMonths: true, category: true } }),
      prisma.msTrainingRecord.findMany({ where: { organizationId: orgId }, select: { id: true, competenceId: true, personUserId: true, personName: true, employer: true, completedOn: true, expiresOn: true } }),
      prisma.hsIncidentReport.findMany({ where: { organizationId: orgId, occurredAt: { gte: since } }, select: { incidentType: true, riddorReportable: true } }),
      prisma.msSupplierEvaluation.findMany({ where: { organizationId: orgId }, select: { approvalStatus: true, evaluatedOn: true } }),
      prisma.msAudit.findMany({ where: { organizationId: orgId, status: "completed" }, select: { completedOn: true } }),
      prisma.msManagementReview.findMany({ where: { organizationId: orgId, status: "held" }, select: { heldOn: true } }),
      prisma.msCorrectiveAction.count({ where: { organizationId: orgId, status: "closed", updatedAt: { gte: yearAgo } } }),
      prisma.msInspection.count({ where: { organizationId: orgId, createdAt: { gte: yearAgo } } }),
      prisma.msRisk.count({ where: { organizationId: orgId } }),
      prisma.methodStatement.count({ where: { organizationId: orgId } }),
      prisma.legalRegisterEntry.count({ where: { organizationId: orgId } }),
      prisma.environmentalAspect.count({ where: { organizationId: orgId } }),
      prisma.environmentalPermit.count({ where: { organizationId: orgId } }),
      prisma.publishedSnapshot.findFirst({
        where: { organizationId: orgId },
        orderBy: [{ reportingPeriod: { endDate: "desc" } }, { version: "desc" }],
        select: { reportingPeriodId: true, reportingPeriod: { select: { label: true } } },
      }),
      prisma.carbonReductionPlan.findFirst({
        where: { organizationId: orgId },
        orderBy: { reportingPeriod: { endDate: "desc" } },
        select: { status: true, sections: true, reportingPeriod: { select: { label: true } } },
      }),
    ]);

  // Headline total of the latest published snapshot, the same figure reports show.
  const totalT = snapshot ? Math.round((await computePeriodTotals(orgId, snapshot.reportingPeriodId)).total * 10) / 10 : null;

  const certificates: PqqContext["certificates"] = {};
  for (const a of adoptions) {
    const f = getFramework(a.frameworkSlug);
    const states = new Map(statuses.filter((s) => s.frameworkSlug === a.frameworkSlug).map((s) => [s.requirementCode, s.status as RequirementState]));
    certificates[a.frameworkSlug] = {
      status: a.status,
      certificateNumber: a.certificateNumber,
      certificationBody: a.certificationBody,
      certifiedUntil: a.certifiedUntil,
      percent: f ? readiness(f, states).percent : null,
    };
  }

  const matrix = trainingMatrix(competences, trainingRecords, today);
  const cardIds = new Set(competences.filter((c) => c.category === "card_scheme").map((c) => c.id));
  const cardHolders = matrix.rows.filter((r) => Object.entries(r.cells).some(([id, c]) => cardIds.has(id) && c.state !== "expired")).length;
  const sections = (crp?.sections ?? {}) as { organisation?: { publicationUrl?: string } };
  const latest = (xs: Array<Date | null>) => xs.filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    orgName: org?.name ?? "",
    entities,
    certificates,
    documents: [
      ...policies.map((p) => ({ title: p.title, category: p.category, version: p.version, approvedOn: p.approvedOn, reviewOn: p.reviewOn, kind: "policy" as const })),
      ...documents.map((p) => ({ title: p.title, category: p.docType, version: p.version, approvedOn: p.approvedOn, reviewOn: p.reviewOn, kind: "document" as const })),
    ],
    training: {
      people: matrix.rows.length,
      records: trainingRecords.length,
      expired: matrix.totals.expired,
      expiring: matrix.totals.expiring,
      competences: competences.map((c) => c.title),
      cardHolders,
    },
    incidents: {
      since,
      total: incidents.length,
      riddor: incidents.filter((i) => i.riddorReportable).length,
      lostTime: incidents.filter((i) => i.incidentType === "lost_time_injury").length,
      nearMiss: incidents.filter((i) => i.incidentType === "near_miss").length,
    },
    suppliers: { evaluated: evaluations.length, approved: evaluations.filter((e) => e.approvalStatus === "approved" || e.approvalStatus === "conditional").length, lastOn: latest(evaluations.map((e) => e.evaluatedOn)) },
    checks: {
      auditsCompleted: audits.filter((a) => a.completedOn && a.completedOn >= yearAgo).length,
      lastAuditOn: latest(audits.map((a) => a.completedOn)),
      lastReviewOn: latest(reviews.map((r) => r.heldOn)),
      closedActions,
      inspections,
    },
    records: { risks, methodStatements, legalRegister: legal, aspects, permits },
    carbon: {
      period: snapshot?.reportingPeriod.label ?? null,
      totalT,
      crpPeriod: crp?.reportingPeriod.label ?? null,
      crpStatus: crp?.status ?? null,
      crpUrl: sections.organisation?.publicationUrl || null,
    },
    gdprAdopted: adoptions.some((a) => a.frameworkSlug === "uk-gdpr" || a.frameworkSlug === "eu-gdpr-2016"),
  };
}

function draftFn(id: DraftFn, c: PqqContext): string | null {
  switch (id) {
    case "identity_name":
      return c.entities.length ? c.entities.map((e) => e.name).join("; ") : c.orgName || null;
    case "identity_registration": {
      const withNumber = c.entities.filter((e) => e.registrationNumber);
      return withNumber.length ? withNumber.map((e) => `${e.name}: ${e.registrationNumber}`).join("; ") : null;
    }
    case "training":
      if (!c.training.records) return null;
      return `We keep a training matrix of ${c.training.competences.length} competence requirements (${c.training.competences.slice(0, 8).join(", ")}${c.training.competences.length > 8 ? ", ..." : ""}) with ${c.training.records} training records for ${c.training.people} people. Expiry dates are tracked and reminders sent before they lapse; ${c.training.expiring} expire in the next 60 days and ${c.training.expired} have expired and are being renewed.`;
    case "workforce_cards":
      return c.training.cardHolders ? `${c.training.cardHolders} people in our training matrix hold a current card from a recognised scheme; cards and expiry dates are recorded against each person.` : null;
    case "incidents": {
      const i = c.incidents;
      if (!i.total) return null;
      return `Accidents, incidents and near misses are reported and investigated through our incident reporting process, with corrective actions tracked to close. Since ${d(i.since)} we have recorded ${i.total} incidents, including ${i.nearMiss} near misses, ${i.lostTime} lost time injuries and ${i.riddor} reportable under RIDDOR.`;
    }
    case "subcontractor_evaluation":
      return c.suppliers.evaluated
        ? `Suppliers and subcontractors are evaluated before use and re-evaluated on a set date, covering quality, health and safety and environmental performance and accreditations. ${c.suppliers.evaluated} have been evaluated, ${c.suppliers.approved} are approved${c.suppliers.lastOn ? `; the latest evaluation was on ${d(c.suppliers.lastOn)}` : ""}.`
        : null;
    case "review_improve": {
      const k = c.checks;
      if (!k.auditsCompleted && !k.lastReviewOn && !k.inspections) return null;
      return [
        k.auditsCompleted ? `${k.auditsCompleted} internal audits were completed in the last 12 months${k.lastAuditOn ? `, the latest on ${d(k.lastAuditOn)}` : ""}.` : null,
        k.inspections ? `${k.inspections} inspections were carried out in the last 12 months against our checklists.` : null,
        k.lastReviewOn ? `Top management last reviewed the management system on ${d(k.lastReviewOn)}.` : null,
        k.closedActions ? `${k.closedActions} corrective actions were closed with a check that they worked.` : null,
      ].filter(Boolean).join(" ");
    }
    case "risk_assessment":
      return c.records.methodStatements || c.records.risks
        ? `Hazards are identified and assessed for each activity, with risk assessments and method statements (${c.records.methodStatements} on record) and a risk and opportunity register of ${c.records.risks} entries reviewed on set dates.`
        : null;
    case "legal_compliance":
      return c.records.legalRegister || c.records.aspects
        ? `We keep a legal register of ${c.records.legalRegister} obligations and an aspects and impacts register of ${c.records.aspects} entries${c.records.permits ? `, with ${c.records.permits} permits and exemptions` : ""}, and evaluate compliance against them.`
        : null;
    case "carbon_reporting":
      return c.carbon.period && c.carbon.totalT != null
        ? `Yes. We measure our Scope 1, 2 and 3 greenhouse gas emissions under the GHG Protocol using government conversion factors. Our latest published figures, for ${c.carbon.period}, total ${c.carbon.totalT.toLocaleString("en-GB")} tCO2e.`
        : null;
    case "carbon_reduction_plan":
      return c.carbon.crpPeriod
        ? `Yes. Our Carbon Reduction Plan for ${c.carbon.crpPeriod} follows the PPN 006 template${c.carbon.crpUrl ? ` and is published at ${c.carbon.crpUrl}` : ""}.`
        : null;
    case "data_protection_records": {
      const g = c.certificates["uk-gdpr"] ?? c.certificates["eu-gdpr-2016"];
      return g ? `We manage data protection against each article of the GDPR, including the record of processing (Article 30); ${g.percent ?? 0}% of its requirements are implemented.` : null;
    }
  }
}

/** A suggested answer for the topic from the organisation's records, or null when they hold nothing to go on. */
export function draftAnswer(topic: Topic, c: PqqContext): { response: "yes" | "no" | null; answer: string } | null {
  const src = topic.draft;
  if (!src) return null;
  if (src.kind === "fn") {
    const text = draftFn(src.id, c);
    return text ? { response: topic.yesNo ? "yes" : null, answer: text } : null;
  }
  if (src.kind === "certificate") {
    for (const slug of src.frameworks) {
      const cert = c.certificates[slug];
      if (!cert) continue;
      if (cert.status === "certified") {
        return {
          response: "yes",
          answer: `Yes. Certified to ${src.name}${cert.certificationBody ? ` by ${cert.certificationBody}` : ""}${cert.certificateNumber ? `, certificate ${cert.certificateNumber}` : ""}${cert.certifiedUntil ? `, valid until ${d(cert.certifiedUntil)}` : ""}.`,
        };
      }
      return { response: "no", answer: `No. We are working towards ${src.name}${cert.percent != null ? `; ${cert.percent}% of its requirements are implemented` : ""}.` };
    }
    return null;
  }
  const doc = c.documents.find((x) => src.match.test(x.title) || (x.category ? src.match.test(x.category) : false));
  if (!doc) return null;
  return {
    response: "yes",
    answer: `Yes. Our ${doc.title} (version ${doc.version}${doc.approvedOn ? `, approved ${d(doc.approvedOn)}` : ""}${doc.reviewOn ? `, next review ${d(doc.reviewOn)}` : ""}) is attached.`,
  };
}

export function draftAll(c: PqqContext): Record<string, { response: "yes" | "no" | null; answer: string }> {
  const out: Record<string, { response: "yes" | "no" | null; answer: string }> = {};
  for (const t of TOPICS) {
    const draft = draftAnswer(t, c);
    if (draft) out[t.key] = draft;
  }
  return out;
}
