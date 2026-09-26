export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { TENDER_EDITORS, TENDER_READERS } from "@/lib/tenders/fts";
import { hasFeature } from "@/lib/billing/limits";
import { TendersWorkspace, type OpportunityView, type WatchView } from "./workspace";


export default async function TendersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let role: string;
  try {
    const { membership } = await requireOrgMember(orgId, ...TENDER_READERS);
    role = membership.role;
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <div className="p-8 text-sm text-[#6B7280]">You do not have permission to view tenders.</div>;
  }

  const [watch, rows, org] = await Promise.all([
    prisma.tenderWatch.findUnique({ where: { organizationId: orgId } }),
    prisma.tenderOpportunity.findMany({
      where: { organizationId: orgId, OR: [{ deadline: null }, { deadline: { gt: new Date() } }] },
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: 200,
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true, isPilot: true } }),
  ]);

  const watchView: WatchView | null = watch
    ? {
        enabled: watch.enabled,
        cpvPrefixes: watch.cpvPrefixes,
        regions: watch.regions,
        keywords: watch.keywords,
        minValue: watch.minValue == null ? null : Number(watch.minValue),
        lastCheckedAt: watch.lastCheckedAt?.toISOString() ?? null,
      }
    : null;
  const opportunities: OpportunityView[] = rows.map((r) => ({
    id: r.id,
    noticeId: r.noticeId,
    title: r.title,
    buyerName: r.buyerName,
    value: r.valueAmount == null ? null : Number(r.valueAmount),
    currency: r.currency,
    deadline: r.deadline?.toISOString() ?? null,
    publishedAt: r.publishedAt.toISOString(),
    regions: r.regions,
    matchedOn: r.matchedOn,
    flags: Array.isArray(r.flags) ? (r.flags as OpportunityView["flags"]) : [],
    status: r.status,
  }));

  return (
    <TendersWorkspace
      orgId={orgId}
      canEdit={(TENDER_EDITORS as string[]).includes(role)}
      planIncludes={!!org && (org.isPilot || hasFeature(org.plan, "bidCarbonPack"))}
      watch={watchView}
      opportunities={opportunities}
    />
  );
}
