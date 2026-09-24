import Link from "next/link";
import { Prisma } from "@prisma/client";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { SCOPE_ROLLUP_DIMENSIONS } from "@/lib/calculation/aggregate-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ snapshotId?: string }>;
};

const t = (kg: number) => `${(kg / 1000).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tCO₂e`;
const n = (v: number) => v.toLocaleString("en-GB");
const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

// How a published snapshot's figures were produced, stage by stage, from the
// organisation's own records: where the activity came from, how it was
// reviewed, which factor libraries priced it, and what was published and
// reported. Defaults to the latest published snapshot.
export default async function DataLineagePage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { snapshotId } = await searchParams;
  await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

  const snapshots = await prisma.publishedSnapshot.findMany({
    where: { organizationId: orgId },
    orderBy: { publishedAt: "desc" },
    take: 20,
    select: { id: true, version: true, publishedAt: true, reportingPeriod: { select: { label: true } } },
  });
  const selectedId = snapshots.find((s) => s.id === snapshotId)?.id ?? snapshots[0]?.id;

  if (!selectedId) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-semibold text-[#111827]">Data lineage</h1>
        <p className="mt-2 max-w-xl text-sm text-[#6B7280]">
          Lineage traces a published snapshot back to its records. Publish a calculation run from{" "}
          <Link className="text-[#c2410c] underline" href={`/orgs/${orgId}/calculations`}>
            Calculations
          </Link>{" "}
          to see it here.
        </p>
      </div>
    );
  }

  const snapshot = await prisma.publishedSnapshot.findFirstOrThrow({
    where: { id: selectedId, organizationId: orgId },
    include: {
      reportingPeriod: { select: { id: true, label: true } },
      publishedBy: { select: { name: true, email: true } },
      calculationRun: {
        select: {
          id: true,
          startedAt: true,
          finishedAt: true,
          factorLibrary: { select: { name: true, version: true } },
          methodologyVersion: { select: { name: true, gwpVersion: true } },
        },
      },
    },
  });
  const runId = snapshot.calculationRun.id;
  const periodId = snapshot.reportingPeriod.id;

  const [records, imported, fromField, approved, calcs, sources, scopes, reports] = await Promise.all([
    prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: periodId } }),
    prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: periodId, importBatchId: { not: null } } }),
    prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT count(*) AS n FROM field_submissions fs
      JOIN activity_records ar ON ar.id = fs.activity_record_id AND ar.organization_id = fs.organization_id
      WHERE fs.organization_id = ${orgId} AND ar.reporting_period_id = ${periodId}`).then((r) => Number(r[0]?.n ?? 0)),
    prisma.activityRecord.count({ where: { organizationId: orgId, reportingPeriodId: periodId, reviewStatus: "approved" } }),
    prisma.$queryRaw<{ total: bigint; with_warnings: bigint; zero: bigint }[]>(Prisma.sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE warnings::text <> '[]') AS with_warnings,
             count(*) FILTER (WHERE total_co2e = 0) AS zero
      FROM emission_calculations
      WHERE organization_id = ${orgId} AND calculation_run_id = ${runId}`),
    prisma.$queryRaw<{ source: string; calcs: bigint }[]>(Prisma.sql`
      SELECT CASE WHEN c.organization_emission_factor_id IS NOT NULL THEN 'Organisation factors'
                  WHEN fl.id IS NOT NULL THEN fl.name || ' ' || fl.version
                  ELSE 'No factor matched' END AS source,
             count(*) AS calcs
      FROM emission_calculations c
      LEFT JOIN emission_factors ef ON ef.id = c.emission_factor_id
      LEFT JOIN factor_libraries fl ON fl.id = ef.factor_library_id
      WHERE c.organization_id = ${orgId} AND c.calculation_run_id = ${runId}
      GROUP BY 1 ORDER BY 2 DESC`),
    prisma.dashboardAggregate.groupBy({
      by: ["scope"],
      where: { organizationId: orgId, snapshotId: selectedId, facilityId: null, ...SCOPE_ROLLUP_DIMENSIONS },
      _sum: { totalCo2e: true },
      orderBy: { scope: "asc" },
    }),
    prisma.report.findMany({
      where: { organizationId: orgId, snapshotId: selectedId },
      select: { id: true, type: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const c = calcs[0] ?? { total: BigInt(0), with_warnings: BigInt(0), zero: BigInt(0) };
  const scopeTotals = scopes.map((s) => ({ scope: s.scope, kg: Number(s._sum.totalCo2e ?? 0) }));
  const headline = scopeTotals.reduce((sum, s) => sum + s.kg, 0);

  const stages: { title: string; lines: string[]; href?: { label: string; to: string } }[] = [
    {
      title: "Activity data",
      lines: [
        `${n(records)} records in ${snapshot.reportingPeriod.label}`,
        `${n(imported)} from imports, ${n(fromField)} from field submissions, ${n(Math.max(0, records - imported - fromField))} entered by hand`,
      ],
      href: { label: "Records", to: `/orgs/${orgId}/records` },
    },
    {
      title: "Review",
      lines: [`${n(approved)} of ${n(records)} records approved`],
      href: { label: "Submissions", to: `/orgs/${orgId}/submissions` },
    },
    {
      title: "Factor selection",
      lines: sources.map((s) => `${s.source}: ${n(Number(s.calcs))} calculations`),
    },
    {
      title: "Calculation",
      lines: [
        `Run on ${snapshot.calculationRun.factorLibrary.name} ${snapshot.calculationRun.factorLibrary.version}, ${snapshot.calculationRun.methodologyVersion.name} (${snapshot.calculationRun.methodologyVersion.gwpVersion})`,
        `${n(Number(c.total))} calculations, ${n(Number(c.with_warnings))} with warnings, ${n(Number(c.zero))} at zero`,
        ...(snapshot.calculationRun.finishedAt ? [`Finished ${when(snapshot.calculationRun.finishedAt)}`] : []),
      ],
      href: { label: "Calculation run", to: `/orgs/${orgId}/calculations/${runId}` },
    },
    {
      title: "Publication",
      lines: [
        `Snapshot v${snapshot.version}, published ${when(snapshot.publishedAt)} by ${snapshot.publishedBy.name ?? snapshot.publishedBy.email}`,
        ...scopeTotals.map((s) => `Scope ${s.scope}: ${t(s.kg)}`),
        `Total (location-based Scope 2): ${t(headline)}`,
      ],
    },
    {
      title: "Reports",
      lines: reports.length ? reports.map((r) => `${r.type.replace(/_/g, " ")}: ${r.status}, ${when(r.createdAt)}`) : ["No reports generated from this snapshot yet"],
      href: { label: "Reports", to: `/orgs/${orgId}/reports` },
    },
  ];

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#111827]">Data lineage</h1>
          <p className="mt-1 text-sm text-[#6B7280]">How the published figures for {snapshot.reportingPeriod.label} were produced, from records to reports.</p>
        </div>
        <form className="flex items-center gap-2">
          <label htmlFor="snapshotId" className="text-sm text-[#374151]">
            Snapshot
          </label>
          <select id="snapshotId" name="snapshotId" defaultValue={selectedId} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reportingPeriod.label} v{s.version}
              </option>
            ))}
          </select>
          <button type="submit" className="h-9 rounded-md border border-[#E5E7EB] px-3 text-sm hover:bg-[#F9FAFB]">
            Show
          </button>
        </form>
      </div>

      <ol className="space-y-4">
        {stages.map((stage, i) => (
          <li key={stage.title}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
                <CardTitle className="flex items-center gap-3 text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff7ed] text-xs font-medium text-[#c2410c]">{i + 1}</span>
                  {stage.title}
                </CardTitle>
                {stage.href ? (
                  <Link href={stage.href.to} className="text-sm text-[#c2410c] hover:underline">
                    {stage.href.label}
                  </Link>
                ) : null}
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-[#374151]">
                  {stage.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-xs text-[#6B7280]">
        <Badge variant="outline" className="mr-2">
          Read only
        </Badge>
        Figures are counted from this organisation&apos;s records when the page loads.
      </p>
    </div>
  );
}
