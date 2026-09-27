import type { MsEvidenceKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { getFramework, headingCodes, transitionMap, type CatalogueFramework } from "./catalogue";
import type { RequirementState } from "./readiness";

// Moving an organisation from one edition of a standard to the next (ISO
// 14001:2015 to 2026). The new edition is adopted alongside the old one,
// which stays until the certificate moves; each new requirement starts from
// the requirements it carries on from, and anything the revision changed is
// left "in progress" so someone checks it against the new wording.

type OldStatus = {
  requirementCode: string;
  status: RequirementState;
  ownerUserId: string | null;
  dueOn: Date | null;
  notes: string | null;
  interpretation: string | null;
};
type OldLink = { requirementCode: string; kind: MsEvidenceKind; targetId: string | null; url: string | null; label: string; note: string | null };

export type TransitionPlan = {
  statuses: Array<{ requirementCode: string; status: RequirementState; ownerUserId: string | null; dueOn: Date | null; notes: string | null; interpretation: string | null }>;
  links: Array<OldLink>;
  /** Requirements to look at: new ones, and changed ones that were carried over. */
  toReview: string[];
};

const ORDER: RequirementState[] = ["not_started", "in_progress", "implemented"];

/** The least advanced of the carried-over states; not applicable only when every source was. */
function combine(states: RequirementState[]): RequirementState {
  if (!states.length) return "not_started";
  if (states.every((s) => s === "not_applicable")) return "not_applicable";
  const applicable = states.filter((s) => s !== "not_applicable");
  return applicable.reduce((a, b) => (ORDER.indexOf(b) < ORDER.indexOf(a) ? b : a), "implemented" as RequirementState);
}

/** Pure: the rows the new edition starts with. */
export function planTransition(next: CatalogueFramework, previous: CatalogueFramework, statuses: OldStatus[], links: OldLink[]): TransitionPlan {
  const map = transitionMap(next, previous);
  const headings = headingCodes(next);
  const byCode = new Map(statuses.map((s) => [s.requirementCode, s]));
  const plan: TransitionPlan = { statuses: [], links: [], toReview: [] };

  for (const r of next.requirements) {
    if (headings.has(r.code)) continue;
    const { from, change } = map.get(r.code)!;
    const sources = from.map((c) => byCode.get(c)).filter((s): s is OldStatus => !!s);
    const needsReview = change?.kind === "new" || change?.kind === "changed";
    if (needsReview) plan.toReview.push(r.code);

    if (sources.length) {
      let status = combine(sources.map((s) => s.status));
      if (needsReview && status === "implemented") status = "in_progress";
      const carried = `Carried over from ${previous.shortName} ${from.join(" and ")}.${needsReview ? ` Check against the ${next.edition} wording: ${change!.note}` : ""}`;
      const oldNotes = sources.map((s) => s.notes).filter(Boolean).join("\n\n");
      plan.statuses.push({
        requirementCode: r.code,
        status,
        ownerUserId: sources.find((s) => s.ownerUserId)?.ownerUserId ?? null,
        dueOn: sources.find((s) => s.dueOn)?.dueOn ?? null,
        notes: [oldNotes, carried].filter(Boolean).join("\n\n").slice(0, 5000),
        interpretation: sources.length === 1 ? sources[0].interpretation : null,
      });
    }

    const seen = new Set<string>();
    for (const l of links) {
      if (!from.includes(l.requirementCode)) continue;
      const key = `${l.kind}|${l.targetId ?? ""}|${l.url ?? ""}|${l.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plan.links.push({ ...l, requirementCode: r.code });
    }
  }
  return plan;
}

export class TransitionError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

/** Adopts `nextSlug` for the organisation, carrying statuses and evidence from the edition it supersedes. */
export async function transitionFramework(orgId: string, nextSlug: string, userId: string) {
  const next = getFramework(nextSlug);
  const previous = next?.supersedes ? getFramework(next.supersedes) : null;
  if (!next || !previous) throw new TransitionError("That framework has no earlier edition to transition from.", 404, "NOT_FOUND");

  const [oldAdoption, existing] = await Promise.all([
    prisma.msFrameworkAdoption.findUnique({ where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: previous.slug } } }),
    prisma.msFrameworkAdoption.findUnique({ where: { organizationId_frameworkSlug: { organizationId: orgId, frameworkSlug: next.slug } } }),
  ]);
  if (!oldAdoption || oldAdoption.status === "withdrawn") throw new TransitionError(`Adopt ${previous.shortName} first, or adopt ${next.shortName} directly.`, 409, "NOT_ADOPTED");
  if (existing && existing.status !== "withdrawn") throw new TransitionError(`${next.shortName} is already adopted.`, 409, "ALREADY_ADOPTED");

  const [statuses, links] = await Promise.all([
    prisma.msRequirementStatus.findMany({ where: { organizationId: orgId, frameworkSlug: previous.slug } }),
    prisma.msEvidenceLink.findMany({ where: { organizationId: orgId, frameworkSlug: previous.slug } }),
  ]);
  const plan = planTransition(
    next,
    previous,
    statuses.map((s) => ({ ...s, status: s.status as RequirementState })),
    links,
  );

  const adoption = await prisma.$transaction(async (tx) => {
    const a = existing
      ? await tx.msFrameworkAdoption.update({ where: { id: existing.id }, data: { status: "implementing", scope: oldAdoption.scope, targetDate: oldAdoption.targetDate } })
      : await tx.msFrameworkAdoption.create({
          data: { organizationId: orgId, frameworkSlug: next.slug, adoptedByUserId: userId, scope: oldAdoption.scope, targetDate: oldAdoption.targetDate },
        });
    for (const s of plan.statuses) {
      const data = { status: s.status, ownerUserId: s.ownerUserId, dueOn: s.dueOn, notes: s.notes, interpretation: s.interpretation, updatedByUserId: userId };
      await tx.msRequirementStatus.upsert({
        where: { organizationId_frameworkSlug_requirementCode: { organizationId: orgId, frameworkSlug: next.slug, requirementCode: s.requirementCode } },
        create: { organizationId: orgId, frameworkSlug: next.slug, requirementCode: s.requirementCode, ...data },
        update: data,
      });
    }
    if (plan.links.length) {
      await tx.msEvidenceLink.createMany({
        data: plan.links.map((l) => ({ ...l, organizationId: orgId, frameworkSlug: next.slug, createdByUserId: userId })),
      });
    }
    return a;
  });

  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "management_system.transitioned",
    resourceType: "MsFrameworkAdoption",
    resourceId: adoption.id,
    metadata: { from: previous.slug, to: next.slug, statuses: plan.statuses.length, links: plan.links.length, toReview: plan.toReview.length },
  });
  return { adoption, carried: plan.statuses.length, links: plan.links.length, toReview: plan.toReview };
}
