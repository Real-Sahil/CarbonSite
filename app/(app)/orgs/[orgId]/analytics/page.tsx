export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowRight, LineChart, TrendingDown, TrendingUp } from "lucide-react";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BklitScopeRing } from "@/components/charts/bklit-scope-ring";
import { BklitCategoryBar } from "@/components/charts/bklit-category-bar";
import { BklitTrendArea, type TrendLineDatum } from "@/components/charts/bklit-trend-area";
import { BklitDataGauge } from "@/components/charts/bklit-data-gauge";
import { AnalyticsFilters } from "./analytics-filters";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{
    periodId?: string;
    scope?: string;
    facilityId?: string;
    categoryId?: string;
  }>;
}

function fmtCo2e(kg: number): string {
  if (kg === 0) return "0";
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(2)} ktCO₂e`;
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(2)} tCO₂e`;
  return `${kg.toFixed(1)} kgCO₂e`;
}

function pct(num: number, denom: number): number {
  return denom > 0 ? Math.round((num / denom) * 100) : 0;
}

export default async function AnalyticsPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const {
    periodId: selectedPeriodId,
    scope: selectedScope,
    facilityId: selectedFacilityId,
    categoryId: selectedCategoryId,
  } = await searchParams;

  await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

  // ── Filter options ──────────────────────────────────────────────────────
  const [periods, facilities, categories] = await Promise.all([
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true, startDate: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.emissionCategory.findMany({
      select: { id: true, name: true, scope: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
  ]);

  const activePeriod = selectedPeriodId
    ? periods.find((p) => p.id === selectedPeriodId) ?? periods[0] ?? null
    : periods[0] ?? null;

  const scopeFilter = selectedScope ? Number(selectedScope) : null;

  // ── Data quality (latest succeeded run) ─────────────────────────────────
  const latestRun = await prisma.calculationRun.findFirst({
    where: { organizationId: orgId, status: "succeeded" },
    orderBy: { createdAt: "desc" },
    select: { id: true, finishedAt: true, reportingPeriodId: true },
  });

  // ── Main data fetches ───────────────────────────────────────────────────
  const [
    scopeAggregates,
    categoryAggregates,
    trendRaw,
    facilityAggregates,
    qualityBatch,
    periodTotals,
  ] = await Promise.all([
    // Scope breakdown for selected period
    activePeriod
      ? prisma.dashboardAggregate.groupBy({
          by: ["scope"],
          where: {
            organizationId: orgId,
            reportingPeriodId: activePeriod.id,
            snapshotId: null,
            emissionCategoryId: null,
            ...(selectedFacilityId ? { facilityId: selectedFacilityId } : { facilityId: null }),
            businessUnitId: null,
            ...(scopeFilter ? { scope: scopeFilter } : {}),
          },
          _sum: { totalCo2e: true, recordCount: true },
          orderBy: { scope: "asc" },
        })
      : Promise.resolve([] as { scope: number; _sum: { totalCo2e: string | null; recordCount: number | null } }[]),

    // Category breakdown — top 10
    activePeriod
      ? prisma.dashboardAggregate.findMany({
          where: {
            organizationId: orgId,
            reportingPeriodId: activePeriod.id,
            snapshotId: null,
            emissionCategoryId: { not: null },
            ...(selectedFacilityId ? { facilityId: selectedFacilityId } : { facilityId: null }),
            ...(scopeFilter ? { scope: scopeFilter } : {}),
            ...(selectedCategoryId ? { emissionCategoryId: selectedCategoryId } : {}),
          },
          include: { emissionCategory: { select: { name: true, scope: true } } },
          orderBy: { totalCo2e: "desc" },
          take: 10,
        })
      : Promise.resolve([] as { id: string; scope: number; totalCo2e: string; recordCount: number; emissionCategory: { name: string; scope: number } | null }[]),

    // Trend: all periods, scope-level
    prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId: null,
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
        ...(scopeFilter ? { scope: scopeFilter } : {}),
      },
      select: {
        scope: true,
        totalCo2e: true,
        reportingPeriod: { select: { id: true, label: true, startDate: true } },
      },
    }),

    // Facility breakdown for selected period
    activePeriod
      ? prisma.dashboardAggregate.findMany({
          where: {
            organizationId: orgId,
            reportingPeriodId: activePeriod.id,
            snapshotId: null,
            emissionCategoryId: null,
            businessUnitId: null,
            facilityId: { not: null },
            ...(scopeFilter ? { scope: scopeFilter } : {}),
            ...(selectedFacilityId ? { facilityId: selectedFacilityId } : {}),
          },
          include: { facility: { select: { id: true, name: true } } },
          orderBy: { totalCo2e: "desc" },
          take: 10,
        })
      : Promise.resolve([] as { id: string; totalCo2e: string; recordCount: number; facilityId: string | null; facility: { id: string; name: string } | null }[]),

    // Data quality signals
    Promise.all([
      latestRun
        ? prisma.emissionCalculation.aggregate({
            where: { calculationRunId: latestRun.id, organizationId: orgId },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
      latestRun
        ? prisma.emissionCalculation.aggregate({
            where: {
              calculationRunId: latestRun.id,
              organizationId: orgId,
              activityRecord: { reviewStatus: "approved" },
            },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
      prisma.activityRecord.count({
        where: { organizationId: orgId, reviewStatus: "approved", evidence: { none: {} } },
      }),
      prisma.activityRecord.count({
        where: { organizationId: orgId, reviewStatus: "approved" },
      }),
      latestRun
        ? prisma.emissionCalculation.aggregate({
            where: {
              calculationRunId: latestRun.id,
              organizationId: orgId,
              selectionReason: { contains: "fallback", mode: "insensitive" },
            },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
    ] as const),

    // Period totals for summary row
    prisma.dashboardAggregate.groupBy({
      by: ["reportingPeriodId"],
      where: {
        organizationId: orgId,
        snapshotId: null,
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
      },
      _sum: { totalCo2e: true, recordCount: true },
    }),
  ]);

  // ── Derived values ───────────────────────────────────────────────────────
  const scopeDonutData = [1, 2, 3]
    .map((scope) => {
      const agg = scopeAggregates.find((r) => r.scope === scope);
      return { scope, label: `Scope ${scope}`, value: Number(agg?._sum.totalCo2e ?? 0) };
    })
    .filter((d) => d.value > 0);

  const totalCo2e = scopeDonutData.reduce((s, d) => s + d.value, 0);

  const categoryBarData = categoryAggregates.map((agg) => ({
    name: agg.emissionCategory?.name ?? "Uncategorised",
    scope: agg.emissionCategory?.scope ?? agg.scope,
    value: Number(agg.totalCo2e),
  }));

  // Build trend series
  const trendMap = new Map<string, { startDate: Date; datum: TrendLineDatum }>();
  for (const row of trendRaw) {
    const p = row.reportingPeriod;
    let entry = trendMap.get(p.id);
    if (!entry) {
      entry = { startDate: p.startDate, datum: { label: p.label, scope1: 0, scope2: 0, scope3: 0 } };
      trendMap.set(p.id, entry);
    }
    if (row.scope === 1) entry.datum.scope1 += Number(row.totalCo2e);
    if (row.scope === 2) entry.datum.scope2 += Number(row.totalCo2e);
    if (row.scope === 3) entry.datum.scope3 += Number(row.totalCo2e);
  }
  const trendData = [...trendMap.values()]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((e) => e.datum);

  const facilityBarData = facilityAggregates.map((agg) => ({
    name: agg.facility?.name ?? "Unknown",
    scope: 0,
    value: Number(agg.totalCo2e),
  }));

  // Quality gauges
  const [totalCalcAgg, approvedCalcAgg, missingEvidenceCount, approvedCount, fallbackAgg] = qualityBatch;
  const totalCalcCo2e = Number(totalCalcAgg._sum.totalCo2e ?? 0);
  const approvedCalcCo2e = Number(approvedCalcAgg._sum.totalCo2e ?? 0);
  const fallbackCo2e = Number(fallbackAgg._sum.totalCo2e ?? 0);
  const dataConfidencePct = totalCalcCo2e > 0 ? Math.round((approvedCalcCo2e / totalCalcCo2e) * 100) : 0;
  const evidencePct = approvedCount > 0 ? Math.round(((approvedCount - missingEvidenceCount) / approvedCount) * 100) : 0;
  const fallbackPct = totalCalcCo2e > 0 ? Math.round((fallbackCo2e / totalCalcCo2e) * 100) : 0;
  const cleanFactorPct = 100 - fallbackPct;

  // Period totals summary
  const periodSummaries = periods.map((p) => {
    const row = periodTotals.find((r) => r.reportingPeriodId === p.id);
    return {
      id: p.id,
      label: p.label,
      total: Number(row?._sum.totalCo2e ?? 0),
      records: Number(row?._sum.recordCount ?? 0),
    };
  });

  // Period-over-period delta
  const latestPeriodTotal = trendData.length > 0
    ? (trendData[trendData.length - 1]!.scope1 + trendData[trendData.length - 1]!.scope2 + trendData[trendData.length - 1]!.scope3)
    : 0;
  const prevPeriodTotal = trendData.length > 1
    ? (trendData[trendData.length - 2]!.scope1 + trendData[trendData.length - 2]!.scope2 + trendData[trendData.length - 2]!.scope3)
    : null;
  const deltaSign = prevPeriodTotal !== null && prevPeriodTotal > 0
    ? ((latestPeriodTotal - prevPeriodTotal) / prevPeriodTotal) * 100
    : null;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
                  <LineChart className="h-4 w-4 text-[#111827]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
                  Analytics
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Emissions Analytics
              </h1>
              <p className="text-sm text-[#374151] mt-1">
                Filter, drill down, and analyse your GHG data across periods, scopes, and facilities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activePeriod && <Badge variant="outline">{activePeriod.label}</Badge>}
              {scopeFilter && <Badge variant="secondary">Scope {scopeFilter}</Badge>}
              {selectedFacilityId && (
                <Badge variant="secondary">
                  {facilities.find((f) => f.id === selectedFacilityId)?.name ?? "Facility"}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">

        {/* Filter rail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#374151] uppercase tracking-wide">
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsFilters
              orgId={orgId}
              periods={periods}
              facilities={facilities}
              categories={categories}
              selectedPeriodId={selectedPeriodId ?? null}
              selectedScope={selectedScope ?? null}
              selectedFacilityId={selectedFacilityId ?? null}
              selectedCategoryId={selectedCategoryId ?? null}
            />
          </CardContent>
        </Card>

        {/* KPI summary row */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard
            label="Total footprint"
            value={fmtCo2e(totalCo2e)}
            detail={activePeriod?.label ?? "All periods"}
          />
          <KpiCard
            label="Period change"
            value={deltaSign !== null ? `${deltaSign > 0 ? "+" : ""}${deltaSign.toFixed(1)}%` : "—"}
            detail="vs previous reporting period"
            tone={deltaSign === null ? "neutral" : deltaSign <= 0 ? "good" : "bad"}
            icon={deltaSign !== null && deltaSign <= 0 ? TrendingDown : TrendingUp}
          />
          <KpiCard
            label="Categories tracked"
            value={String(categoryAggregates.length)}
            detail={`out of ${categories.length} total`}
          />
          <KpiCard
            label="Facilities"
            value={String(facilityAggregates.length)}
            detail={selectedFacilityId ? "filtered view" : "all facilities"}
          />
        </div>

        {/* Period comparison table */}
        {periodSummaries.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Period comparison</CardTitle>
              <CardDescription>All-scope totals across your reporting periods.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB]">
                      <th className="px-3 py-2 text-left text-xs font-normal uppercase tracking-wide text-[#374151]">Period</th>
                      <th className="px-3 py-2 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">Total CO₂e</th>
                      <th className="px-3 py-2 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">Records</th>
                      <th className="px-3 py-2 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {periodSummaries.map((p, i) => {
                      const prev = periodSummaries[i + 1];
                      const delta = prev && prev.total > 0
                        ? ((p.total - prev.total) / prev.total) * 100
                        : null;
                      return (
                        <tr key={p.id} className={activePeriod?.id === p.id ? "bg-[#F0F9FF]/60" : "hover:bg-[#F9FAFB]"}>
                          <td className="px-3 py-3 font-normal text-[#111827] tracking-[-0.42px]">
                            {p.label}
                            {activePeriod?.id === p.id && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-[#f97316] px-2 py-0.5 text-[10px] font-medium text-white">
                                Selected
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-normal text-[#111827] tracking-[-0.42px] tabular-nums">
                            {p.total > 0 ? fmtCo2e(p.total) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right text-xs text-[#374151] tabular-nums">
                            {p.records.toLocaleString("en-GB")}
                          </td>
                          <td className="px-3 py-3 text-right text-xs tabular-nums">
                            {delta !== null ? (
                              <span className={delta <= 0 ? "text-emerald-600" : "text-red-600"}>
                                {delta > 0 ? "+" : ""}{delta.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-[#9CA3AF]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scope breakdown + Category breakdown */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scope breakdown</CardTitle>
              <CardDescription>
                GHG Protocol scope totals{activePeriod ? ` for ${activePeriod.label}` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scopeDonutData.length > 0 ? (
                <BklitScopeRing data={scopeDonutData} height={300} />
              ) : (
                <EmptyState message="No aggregated scope data for the selected filters." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top categories</CardTitle>
              <CardDescription>
                Up to 10 emission categories ranked by CO₂e{activePeriod ? ` in ${activePeriod.label}` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryBarData.length > 0 ? (
                <BklitCategoryBar data={categoryBarData} height={300} />
              ) : (
                <EmptyState message="No category data for the selected filters." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Trend chart */}
        {trendData.length >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emissions trend</CardTitle>
              <CardDescription>
                Scope-level totals across all reporting periods with calculated aggregates.
                {scopeFilter ? ` Filtered to Scope ${scopeFilter}.` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BklitTrendArea data={trendData} height={280} />
            </CardContent>
          </Card>
        )}

        {/* Facility breakdown */}
        {facilityBarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Facility breakdown</CardTitle>
              <CardDescription>
                CO₂e by facility{activePeriod ? ` for ${activePeriod.label}` : ""}
                {scopeFilter ? `, Scope ${scopeFilter}` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BklitCategoryBar data={facilityBarData} height={Math.max(220, facilityBarData.length * 40)} />
            </CardContent>
          </Card>
        )}

        {/* Data quality gauges */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data quality</CardTitle>
            <CardDescription>
              Four confidence signals from the latest succeeded calculation run.
              {!latestRun && " Run a calculation to populate these metrics."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8 xl:grid-cols-4">
              <GaugePanel
                value={dataConfidencePct}
                label="Data confidence"
                detail="Emissions from approved records"
                active={latestRun !== null}
              />
              <GaugePanel
                value={evidencePct}
                label="Evidence coverage"
                detail="Approved records with linked evidence"
                active={approvedCount > 0}
              />
              <GaugePanel
                value={cleanFactorPct}
                label="Primary factors"
                detail="Emissions using primary (not fallback) factors"
                active={latestRun !== null}
              />
              <GaugePanel
                value={latestRun ? 100 : 0}
                label="Calculation status"
                detail={latestRun ? "Latest run succeeded" : "No succeeded run yet"}
                active={latestRun !== null}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/orgs/${orgId}/records`}>
              View records
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/orgs/${orgId}/calculations`}>
              Calculations
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/orgs/${orgId}/reports`}>
              Generate report
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "bad" | "neutral";
  icon?: React.ElementType;
}) {
  const valueColor =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-[#111827]";
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-[21px]">
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className="h-4 w-4 text-[#374151]" />}
        <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">{label}</p>
      </div>
      <p className={`mt-3 text-3xl font-normal tracking-[-0.4px] ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">{detail}</p>
    </div>
  );
}

function GaugePanel({
  value,
  label,
  detail,
  active,
}: {
  value: number;
  label: string;
  detail: string;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {active ? (
        <BklitDataGauge value={value} label={label} size={160} />
      ) : (
        <div className="h-[160px] w-[160px] flex items-center justify-center rounded-full border-2 border-dashed border-[#E5E7EB]">
          <span className="text-xs text-[#9CA3AF]">No data</span>
        </div>
      )}
      <p className="text-xs text-[#374151] tracking-[-0.36px] max-w-[140px]">{detail}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-[14px] border border-dashed border-[#BAE6FD] bg-[#F0F9FF]">
      <p className="text-sm text-[#374151]">{message}</p>
    </div>
  );
}
