export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { appraisalPrice, coveredCost, e18Gaps, pricesInForce } from "@/lib/carbon-price";
import { latestPublishedScopeTotals, loadCarbonPrices } from "@/lib/carbon-price/load";
import { CarbonPrices } from "./carbon-prices";

export default async function CarbonPricePage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;

  let canEdit = false;
  try {
    const { membership } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor, "reviewer", "viewer", "auditor");
    canEdit = ROLE_GROUPS.editor.includes(membership.role);
  } catch (err) {
    if (err instanceof AuthError && err.status === 401) redirect("/sign-in");
    return <p className="p-8 text-red-600">You do not have access to carbon pricing.</p>;
  }

  const [prices, published, org] = await Promise.all([
    loadCarbonPrices(orgId),
    latestPublishedScopeTotals(orgId),
    prisma.organization.findUnique({ where: { id: orgId }, select: { reportingCurrency: true } }),
  ]);
  const now = new Date();
  const current = appraisalPrice(prices, now);
  const coverage = current && published ? coveredCost(published.totals, current) : null;
  const inForce = new Set(pricesInForce(prices, now).map((p) => p.id));

  return (
    <CarbonPrices
      orgId={orgId}
      canEdit={canEdit}
      defaultCurrency={org?.reportingCurrency ?? "GBP"}
      gaps={e18Gaps(prices, now)}
      current={current ? { id: current.id } : null}
      coverage={
        coverage && published && current
          ? {
              periodLabel: published.periodLabel,
              version: published.version,
              coveredTco2e: coverage.coveredTco2e,
              share: coverage.share,
              cost: coverage.cost,
              currency: current.currency,
            }
          : null
      }
      prices={prices.map((p) => ({
        ...p,
        effectiveFrom: p.effectiveFrom.toISOString().slice(0, 10),
        effectiveTo: p.effectiveTo ? p.effectiveTo.toISOString().slice(0, 10) : null,
        inForce: inForce.has(p.id),
      }))}
    />
  );
}
