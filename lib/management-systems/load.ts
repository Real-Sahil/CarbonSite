import { prisma } from "@/lib/db";
import { FRAMEWORKS, assessableRequirements, catalogueFingerprint, getFramework, headingCodes, sharedRequirements, successorOf, type CatalogueFramework, type EditionChange } from "./catalogue";
import { readiness, type Readiness, type RequirementState } from "./readiness";
import { evidenceHref, KIND_LABELS } from "./evidence";
import { loadSignals, type Signal } from "./signals";
import type { SignalKey } from "./signal-keys";

export type AdoptionSummary = {
  frameworkSlug: string;
  status: string;
  targetDate: string | null;
  certifiedUntil: string | null;
  readiness: Readiness;
};

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Every adopted framework with its readiness, from three queries whatever the number of frameworks. */
export async function loadAdoptions(orgId: string): Promise<AdoptionSummary[]> {
  const [adoptions, statuses, evidence] = await Promise.all([
    prisma.msFrameworkAdoption.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
    prisma.msRequirementStatus.findMany({
      where: { organizationId: orgId },
      select: { frameworkSlug: true, requirementCode: true, status: true },
    }),
    prisma.msEvidenceLink.groupBy({
      by: ["frameworkSlug", "requirementCode"],
      where: { organizationId: orgId },
      _count: { _all: true },
    }),
  ]);
  return adoptions.flatMap((a) => {
    const framework = getFramework(a.frameworkSlug);
    if (!framework) return [];
    const stateMap = new Map(statuses.filter((s) => s.frameworkSlug === a.frameworkSlug).map((s) => [s.requirementCode, s.status as RequirementState]));
    const evidenceMap = new Map(evidence.filter((e) => e.frameworkSlug === a.frameworkSlug).map((e) => [e.requirementCode, e._count._all]));
    return [
      {
        frameworkSlug: a.frameworkSlug,
        status: a.status,
        targetDate: iso(a.targetDate),
        certifiedUntil: iso(a.certifiedUntil),
        readiness: readiness(framework, stateMap, evidenceMap),
      },
    ];
  });
}

export type RequirementView = {
  code: string;
  title: string;
  guidance: string | null;
  parent: string | null;
  depth: number;
  heading: boolean;
  evidenceHints: string[];
  officialText: string | null;
  examples: string[];
  tags: string[];
  url: string | null;
  status: RequirementState;
  ownerUserId: string | null;
  ownerName: string | null;
  dueOn: string | null;
  notes: string | null;
  /** The organisation's own reading, shown in place of MetricOra's guidance. */
  interpretation: string | null;
  updatedAt: string | null;
  signals: Signal[];
  evidence: Array<{ id: string; kind: string; kindLabel: string; label: string; note: string | null; href: string | null; createdAt: string }>;
  alsoCovers: Array<{ slug: string; shortName: string; code: string; status: RequirementState }>;
  /** How this requirement differs from the edition this framework replaces. */
  editionChange: EditionChange | null;
};

export type FrameworkView = {
  framework: Omit<CatalogueFramework, "requirements">;
  adoption: {
    status: string;
    scope: string | null;
    targetDate: string | null;
    certificationBody: string | null;
    certificateNumber: string | null;
    certifiedUntil: string | null;
    guidanceReview: { byName: string; at: string; note: string | null; current: boolean } | null;
  } | null;
  readiness: Readiness | null;
  requirements: RequirementView[];
  members: Array<{ id: string; name: string }>;
  /** Other editions of the same standard and whether the organisation holds them. */
  editions: {
    successor: { slug: string; shortName: string; edition: string; adopted: boolean; transitionDeadline: string | null } | null;
    predecessor: { slug: string; shortName: string; adopted: boolean } | null;
  };
};

/** Everything the framework page shows, or null for an unknown framework. */
export async function loadFrameworkView(orgId: string, slug: string): Promise<FrameworkView | null> {
  const framework = getFramework(slug);
  if (!framework) return null;
  const { requirements, ...meta } = framework;

  const successor = successorOf(slug);
  const predecessor = framework.supersedes ? getFramework(framework.supersedes) : null;
  const [adoption, statuses, links, members, otherStatuses, otherAdoptions] = await Promise.all([
    prisma.msFrameworkAdoption.findUnique({ where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: slug } } }),
    prisma.msRequirementStatus.findMany({ where: { organizationId: orgId, frameworkSlug: slug } }),
    prisma.msEvidenceLink.findMany({ where: { organizationId: orgId, frameworkSlug: slug }, orderBy: { createdAt: "asc" } }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { notIn: ["field_worker", "supplier"] } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.msRequirementStatus.findMany({
      where: { organizationId: orgId, frameworkSlug: { not: slug } },
      select: { frameworkSlug: true, requirementCode: true, status: true },
    }),
    successor || predecessor
      ? prisma.msFrameworkAdoption.findMany({
          where: { organizationId: orgId, frameworkSlug: { in: [successor?.slug, predecessor?.slug].filter((x): x is string => !!x) }, status: { not: "withdrawn" } },
          select: { frameworkSlug: true },
        })
      : Promise.resolve([] as { frameworkSlug: string }[]),
  ]);
  const heldEditions = new Set(otherAdoptions.map((a) => a.frameworkSlug));

  const signalKeys = new Set<SignalKey>(requirements.flatMap((r) => r.signals ?? []));
  const signals = adoption ? await loadSignals(orgId, signalKeys) : new Map<SignalKey, Signal>();

  const memberName = new Map(members.map((m) => [m.user.id, m.user.name || m.user.email]));
  const statusBy = new Map(statuses.map((s) => [s.requirementCode, s]));
  const otherStatusBy = new Map(otherStatuses.map((s) => [`${s.frameworkSlug}|${s.requirementCode}`, s.status as RequirementState]));
  const headings = headingCodes(framework);
  const depthOf = new Map<string, number>();
  for (const r of requirements) depthOf.set(r.code, r.parent ? (depthOf.get(r.parent) ?? 0) + 1 : 0);

  const views: RequirementView[] = requirements.map((r) => {
    const s = statusBy.get(r.code);
    return {
      code: r.code,
      title: r.title,
      guidance: r.guidance ?? null,
      parent: r.parent ?? null,
      depth: depthOf.get(r.code) ?? 0,
      heading: headings.has(r.code),
      evidenceHints: r.evidenceHints ?? [],
      officialText: r.officialText ?? null,
      examples: r.examples ?? [],
      tags: r.tags ?? [],
      url: r.url ?? null,
      status: (s?.status as RequirementState | undefined) ?? "not_started",
      ownerUserId: s?.ownerUserId ?? null,
      ownerName: s?.ownerUserId ? (memberName.get(s.ownerUserId) ?? null) : null,
      dueOn: iso(s?.dueOn ?? null),
      notes: s?.notes ?? null,
      interpretation: s?.interpretation ?? null,
      updatedAt: s ? s.updatedAt.toISOString() : null,
      signals: (r.signals ?? []).flatMap((k) => (signals.has(k) ? [signals.get(k)!] : [])),
      evidence: links
        .filter((l) => l.requirementCode === r.code)
        .map((l) => ({
          id: l.id,
          kind: l.kind,
          kindLabel: KIND_LABELS[l.kind],
          label: l.label,
          note: l.note,
          href: evidenceHref(orgId, l),
          createdAt: l.createdAt.toISOString(),
        })),
      alsoCovers: sharedRequirements(slug, r.code).map(({ framework: f, requirement }) => ({
        slug: f.slug,
        shortName: f.shortName,
        code: requirement.code,
        status: otherStatusBy.get(`${f.slug}|${requirement.code}`) ?? "not_started",
      })),
      editionChange: r.editionChange ?? null,
    };
  });

  const stateMap = new Map(statuses.map((s) => [s.requirementCode, s.status as RequirementState]));
  const evidenceCounts = new Map<string, number>();
  for (const l of links) evidenceCounts.set(l.requirementCode, (evidenceCounts.get(l.requirementCode) ?? 0) + 1);

  return {
    framework: meta,
    adoption: adoption
      ? {
          status: adoption.status,
          scope: adoption.scope,
          targetDate: iso(adoption.targetDate),
          certificationBody: adoption.certificationBody,
          certificateNumber: adoption.certificateNumber,
          certifiedUntil: iso(adoption.certifiedUntil),
          guidanceReview:
            adoption.guidanceReviewedAt && adoption.guidanceReviewedByUserId
              ? {
                  byName: memberName.get(adoption.guidanceReviewedByUserId) ?? "A former member",
                  at: adoption.guidanceReviewedAt.toISOString().slice(0, 10),
                  note: adoption.guidanceReviewNote,
                  current: adoption.guidanceReviewedVersion === catalogueFingerprint(framework),
                }
              : null,
        }
      : null,
    readiness: adoption ? readiness(framework, stateMap, evidenceCounts) : null,
    requirements: views,
    members: members.map((m) => ({ id: m.user.id, name: m.user.name || m.user.email })).sort((a, b) => a.name.localeCompare(b.name)),
    editions: {
      successor: successor
        ? { slug: successor.slug, shortName: successor.shortName, edition: successor.edition, adopted: heldEditions.has(successor.slug), transitionDeadline: successor.transitionDeadline ?? null }
        : null,
      predecessor: predecessor ? { slug: predecessor.slug, shortName: predecessor.shortName, adopted: heldEditions.has(predecessor.slug) } : null,
    },
  };
}

/** The catalogue as the overview lists it. */
export function catalogueSummary() {
  return FRAMEWORKS.map((f) => ({
    slug: f.slug,
    name: f.name,
    shortName: f.shortName,
    edition: f.edition,
    publisher: f.publisher,
    family: f.family,
    jurisdiction: f.jurisdiction ?? null,
    summary: f.summary,
    certifiable: f.certifiable,
    requirementCount: assessableRequirements(f).length,
    supersedes: f.supersedes ?? null,
    supersededBy: successorOf(f.slug)?.slug ?? null,
  }));
}
