export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadSbtiPathway } from "@/lib/calculation/sbti-actuals";
import { computeMacc, buildMaccCurve } from "@/lib/reductions/macc";
import { gradeCells, summarizeCompleteness, type CompletenessCellInput } from "@/lib/inventory/completeness";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Compass, Target, TrendingDown, AlertTriangle, ArrowRight, Grid3x3 } from "lucide-react";

interface PathwayPageProps {
  params: Promise<{ orgId: string }>;
}

export default async function PathwayPage({ params }: PathwayPageProps) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <div className="p-8"><p className="text-sm text-red-600">You do not have permission to view the decarbonisation pathway.</p></div>;
    }
    return <div className="p-8"><p className="text-sm text-red-600">Failed to load page. The database may be updating — try refreshing in a moment.</p></div>;
  }

  const dbResult = await Promise.all([
    loadSbtiPathway(orgId),
    prisma.reductionInitiative.findMany({
      where: { organizationId: orgId, status: { not: "canceled" } },
      select: {
        id: true,
        name: true,
        capexAmount: true,
        costAmount: true,
        opexDeltaAnnual: true,
        lifetimeYears: true,
        expectedImpactCo2e: true,
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, name: true } },
      },
    }),
    prisma.reportingPeriod.findFirst({
      where: { organizationId: orgId },
      orderBy: { startDate: "desc" },
    }),
    prisma.dataCompletenessRequirement.findMany({
      where: { organizationId: orgId, emissionCategoryId: { not: null } },
      include: {
        facility: { select: { id: true, name: true } },
        emissionCategory: { select: { id: true, name: true } },
      },
    }),
  ]).catch(() => null);

  if (!dbResult) {
    return <div className="p-8"><p className="text-sm text-red-600">Failed to load the pathway. The database may be updating — try refreshing in a moment.</p></div>;
  }
  const [pathway, initiatives, currentPeriod, requirements] = dbResult;

  // ── MACC ──────────────────────────────────────────────────────────────────
  const maccEntries = computeMacc(
    initiatives.map((i) => ({
      id: i.id,
      name: i.name,
      capexAmount: i.capexAmount != null ? Number(i.capexAmount) : i.costAmount != null ? Number(i.costAmount) : null,
      opexDeltaAnnual: i.opexDeltaAnnual != null ? Number(i.opexDeltaAnnual) : null,
      lifetimeYears: i.lifetimeYears,
      expectedImpactCo2e: i.expectedImpactCo2e != null ? Number(i.expectedImpactCo2e) / 1000 : null,
    })),
  );
  const maccCurve = buildMaccCurve(maccEntries);
  const initiativeById = new Map(initiatives.map((i) => [i.id, i]));

  // ── Completeness (current reporting period) ─────────────────────────────
  let completenessSummary: ReturnType<typeof summarizeCompleteness> | null = null;
  const gapKeys = new Set<string>(); // "facilityId:emissionCategoryId" cells still red or amber
  if (currentPeriod && requirements.length > 0) {
    const facilityIds = [...new Set(requirements.map((r) => r.facilityId))];
    const records = await prisma.activityRecord.groupBy({
      by: ["facilityId", "emissionCategoryId", "reviewStatus"],
      where: {
        organizationId: orgId,
        reportingPeriodId: currentPeriod.id,
        facilityId: { in: facilityIds },
      },
      _count: { _all: true },
    });
    const countsByKey = new Map<string, { recordCount: number; approvedCount: number }>();
    for (const row of records) {
      if (!row.facilityId) continue;
      const key = `${row.facilityId}:${row.emissionCategoryId}`;
      const existing = countsByKey.get(key) ?? { recordCount: 0, approvedCount: 0 };
      existing.recordCount += row._count._all;
      if (row.reviewStatus === "approved") existing.approvedCount += row._count._all;
      countsByKey.set(key, existing);
    }
    const cellInputs: CompletenessCellInput[] = requirements.map((req) => {
      const counts = countsByKey.get(`${req.facilityId}:${req.emissionCategoryId}`) ?? { recordCount: 0, approvedCount: 0 };
      return {
        facilityId: req.facilityId,
        emissionCategoryId: req.emissionCategoryId!,
        required: req.required,
        ownerUserId: req.ownerUserId,
        recordCount: counts.recordCount,
        approvedCount: counts.approvedCount,
      };
    });
    const cells = gradeCells(cellInputs);
    completenessSummary = summarizeCompleteness(cells);
    for (const cell of cells) {
      if (cell.status === "red" || cell.status === "amber") {
        gapKeys.add(`${cell.facilityId}:${cell.emissionCategoryId}`);
      }
    }
  }

  const topInitiatives = maccCurve.slice(0, 5);

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <Compass className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Strategy</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Decarbonisation pathway</h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Where the target line says you need to be, what it costs to get there, and what data is still
            missing to trust the number — in one place instead of three.
          </p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8 flex flex-col gap-6">
        {/* SBTi target trajectory */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB] flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-[#111827]">Target trajectory</CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                {pathway ? "Expected vs. actual, from your committed SBTi pathway." : "No SBTi target set yet."}
              </CardDescription>
            </div>
            <Link href={`/orgs/${orgId}/sbti`} className="text-xs font-medium text-[#f97316] hover:text-[#ea580c] flex items-center gap-1">
              {pathway ? "View full trajectory" : "Set a target"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-6">
            {!pathway ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF7ED]">
                  <Target className="h-6 w-6 text-[#f97316]" />
                </div>
                <p className="text-sm text-[#374151] max-w-sm">
                  Set a Science-Based Target to see a real target line here, checked against your actual
                  emissions every year.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Base year", value: pathway.target.baseYear.toString(), unit: "" },
                    {
                      label: `Near-term (${pathway.target.nearTermYear})`,
                      value: `-${pathway.target.nearTermReductionPct.toFixed(0)}%`,
                      unit: "vs. baseline",
                    },
                    {
                      label: `Net-zero (${pathway.target.netZeroYear})`,
                      value: `-${pathway.target.netZeroReductionPct.toFixed(0)}%`,
                      unit: "vs. baseline",
                    },
                    {
                      label: "Behind-schedule years",
                      value: pathway.trajectory.filter((p) => p.status === "behind").length.toString(),
                      unit: "of tracked years",
                    },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="rounded-lg border border-[#E5E7EB] p-4">
                      <div className="text-xs font-medium text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</div>
                      <div className="text-xl font-semibold text-[#111827] tabular-nums">{value}</div>
                      {unit && <div className="text-xs text-[#9CA3AF] mt-0.5">{unit}</div>}
                    </div>
                  ))}
                </div>

                {pathway.alerts.length > 0 && (
                  <div className="space-y-1.5">
                    {pathway.alerts.slice(0, 2).map((alert, i) => {
                      const cls =
                        alert.severity === "critical"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : alert.severity === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-blue-200 bg-blue-50 text-blue-800";
                      return (
                        <div key={i} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${cls}`}>
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                          <span>{alert.message}</span>
                        </div>
                      );
                    })}
                    {pathway.alerts.length > 2 && (
                      <p className="text-xs text-[#9CA3AF]">
                        +{pathway.alerts.length - 2} more on the{" "}
                        <Link href={`/orgs/${orgId}/sbti`} className="underline">full trajectory page</Link>.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completeness */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB] flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-[#111827]">Data you're trusting this on</CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                {currentPeriod ? `Completeness for ${currentPeriod.label}.` : "No reporting period found."}
              </CardDescription>
            </div>
            <Link href={`/orgs/${orgId}/completeness`} className="text-xs font-medium text-[#f97316] hover:text-[#ea580c] flex items-center gap-1">
              View full matrix <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-6">
            {!completenessSummary || completenessSummary.totalRequired === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0F9FF]">
                  <Grid3x3 className="h-6 w-6 text-[#111827]" />
                </div>
                <p className="text-sm text-[#374151] max-w-sm">
                  No completeness requirements configured yet — set which facility/category combinations
                  you expect data for on the completeness matrix.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-8">
                <div>
                  <div className="text-3xl font-semibold text-[#111827] tabular-nums">
                    {completenessSummary.completenessPercent.toFixed(0)}%
                  </div>
                  <div className="text-xs text-[#9CA3AF]">of required cells have approved data</div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{completenessSummary.green} green</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />{completenessSummary.amber} amber</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />{completenessSummary.red} red</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* MACC-ranked initiatives */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB] flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-semibold text-[#111827]">Cheapest initiatives first</CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                Ranked by £ per tCO2e abated. A gap badge means this measure also closes a red or amber
                completeness cell.
              </CardDescription>
            </div>
            <Link href={`/orgs/${orgId}/scenarios`} className="text-xs font-medium text-[#f97316] hover:text-[#ea580c] flex items-center gap-1">
              View full curve <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className={topInitiatives.length === 0 ? "pb-8" : "p-0 pb-2"}>
            {topInitiatives.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF7ED]">
                  <TrendingDown className="h-6 w-6 text-[#f97316]" />
                </div>
                <p className="text-sm text-[#374151] max-w-sm">
                  No initiatives with an estimated impact yet.{" "}
                  <Link href={`/orgs/${orgId}/targets`} className="underline">Add one</Link> with a cost and
                  expected reduction to rank it here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {topInitiatives.map((entry) => {
                  const initiative = initiativeById.get(entry.id);
                  const key = initiative?.facility && initiative?.emissionCategory
                    ? `${initiative.facility.id}:${initiative.emissionCategory.id}`
                    : null;
                  const closesGap = key != null && gapKeys.has(key);
                  return (
                    <div key={entry.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[#111827] truncate">{entry.name}</span>
                          {initiative?.facility && (
                            <Badge variant="outline" className="text-xs font-normal">{initiative.facility.name}</Badge>
                          )}
                          {initiative?.emissionCategory && (
                            <Badge variant="outline" className="text-xs font-normal">{initiative.emissionCategory.name}</Badge>
                          )}
                          {closesGap && (
                            <Badge className="text-xs font-normal bg-amber-100 text-amber-900 hover:bg-amber-100">
                              Closes a data gap
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-[#9CA3AF] mt-0.5">
                          {entry.abatementTco2e.toFixed(1)} tCO2e/yr abated
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-sm font-semibold tabular-nums ${entry.marginalCostPerTco2e < 0 ? "text-emerald-600" : "text-[#111827]"}`}>
                          £{entry.marginalCostPerTco2e.toFixed(0)}/tCO2e
                        </div>
                        {entry.paybackYears != null && (
                          <div className="text-xs text-[#9CA3AF]">pays back in {entry.paybackYears.toFixed(1)}y</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
