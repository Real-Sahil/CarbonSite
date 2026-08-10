import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";
import { ScopeDonut } from "@/components/charts/scope-donut";
import { CategoryBar } from "@/components/charts/category-bar";
import { PublishSnapshotButton } from "./publish-snapshot-button";

interface CalculationRunPageProps {
  params: Promise<{ orgId: string; runId: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

const STATUS_CLASSES: Record<string, string> = {
  queued: "bg-slate-100 text-slate-700 border-transparent",
  running: "bg-blue-100 text-blue-700 border-transparent",
  succeeded: "bg-green-100 text-green-700 border-transparent",
  failed: "bg-red-100 text-red-700 border-transparent",
};

function formatTimestamp(value: Date | null): string {
  if (!value) return "Not yet";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTonnes(kg: number): string {
  return `${(kg / 1000).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} tCO2e`;
}

function formatAmount(value: unknown, unit: string): string {
  return `${Number(value).toLocaleString("en-GB", { maximumFractionDigits: 3 })} ${unit}`;
}

export default async function CalculationRunPage({ params }: CalculationRunPageProps) {
  const { orgId, runId } = await params;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const run = await prisma.calculationRun.findFirst({
    where: { id: runId, organizationId: orgId },
    include: {
      reportingPeriod: { select: { label: true } },
      factorLibrary: { select: { name: true, version: true } },
      methodologyVersion: { select: { name: true, gwpVersion: true } },
      triggeredBy: { select: { name: true, email: true } },
      _count: { select: { calculations: true } },
    },
  }).catch(() => null);

  if (!run) notFound();

  // Check whether a snapshot already exists for this reporting period so the
  // publish button can show a diff before overwriting it.
  const existingSnapshot = await prisma.publishedSnapshot
    .findFirst({
      where: { organizationId: orgId, reportingPeriodId: run.reportingPeriodId },
      orderBy: { version: "desc" },
      select: { id: true },
    })
    .catch(() => null);

  const [groupRows, largestCalculations] = await Promise.all([
    prisma.emissionCalculation.findMany({
      where: { organizationId: orgId, calculationRunId: runId },
      select: {
        totalCo2e: true,
        activityRecord: {
          select: {
            emissionCategory: { select: { scope: true, name: true } },
            facility: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.emissionCalculation.findMany({
      where: { organizationId: orgId, calculationRunId: runId },
      select: {
        id: true,
        originalAmount: true,
        originalUnit: true,
        normalizedAmount: true,
        normalizedUnit: true,
        factorLibraryVersion: true,
        formula: true,
        totalCo2e: true,
        activityRecord: {
          select: { sourceDescription: true, supplierName: true },
        },
      },
      orderBy: { totalCo2e: "desc" },
      take: 50,
    }),
  ]);

  // Group server-side; convert Prisma Decimal to number before passing to client charts.
  const scopeTotals = new Map<number, number>();
  const categoryTotals = new Map<string, { name: string; scope: number; value: number }>();
  const facilityTotals = new Map<string, { name: string; value: number }>();

  for (const row of groupRows) {
    const kg = Number(row.totalCo2e);
    const category = row.activityRecord.emissionCategory;
    scopeTotals.set(category.scope, (scopeTotals.get(category.scope) ?? 0) + kg);

    const categoryKey = `${category.scope}:${category.name}`;
    const existingCategory = categoryTotals.get(categoryKey);
    if (existingCategory) {
      existingCategory.value += kg;
    } else {
      categoryTotals.set(categoryKey, { name: category.name, scope: category.scope, value: kg });
    }

    const facility = row.activityRecord.facility;
    if (facility) {
      const existingFacility = facilityTotals.get(facility.id);
      if (existingFacility) {
        existingFacility.value += kg;
      } else {
        facilityTotals.set(facility.id, { name: facility.name, value: kg });
      }
    }
  }

  const scopeData = [1, 2, 3].map((scope) => ({
    scope,
    label: `Scope ${scope}`,
    value: scopeTotals.get(scope) ?? 0,
  }));
  const categoryData = [...categoryTotals.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const facilityData = [...facilityTotals.values()].sort((a, b) => b.value - a.value);
  const totalKg = scopeData.reduce((total, row) => total + row.value, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/orgs/${orgId}/calculations`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#111827] mb-3"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          All calculation runs
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {run.reportingPeriod.label} calculation
            </h1>
            <p className="text-slate-500 mt-1">
              {run.factorLibrary.name} {run.factorLibrary.version} - {run.methodologyVersion.name}{" "}
              ({run.methodologyVersion.gwpVersion})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={STATUS_CLASSES[run.status] ?? STATUS_CLASSES.queued}
            >
              {STATUS_LABELS[run.status] ?? run.status}
            </Badge>
            {run.status === "succeeded" && (
              <PublishSnapshotButton
                orgId={orgId}
                runId={runId}
                existingSnapshotId={existingSnapshot?.id ?? null}
              />
            )}
          </div>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
          <MetaItem label="Triggered by" value={run.triggeredBy.name ?? run.triggeredBy.email} />
          <MetaItem label="Started" value={formatTimestamp(run.startedAt)} />
          <MetaItem label="Finished" value={formatTimestamp(run.finishedAt)} />
          <MetaItem
            label="Calculations"
            value={run._count.calculations.toLocaleString("en-GB")}
          />
          <MetaItem label="Total footprint" value={formatTonnes(totalKg)} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope breakdown</CardTitle>
            <CardDescription>Total CO2e by GHG Protocol scope for this run.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScopeDonut data={scopeData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top categories</CardTitle>
            <CardDescription>Largest emission categories by tCO2e (top 8).</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryBar data={categoryData} ariaLabel="Top emission categories bar chart" />
          </CardContent>
        </Card>

        {facilityData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Facility breakdown</CardTitle>
              <CardDescription>Emissions attributed to facilities in this run.</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBar
                data={facilityData}
                height={Math.max(180, facilityData.length * 44)}
                ariaLabel="Facility emissions bar chart"
              />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Largest calculations{" "}
            <span className="text-sm font-normal text-slate-500">
              (top {largestCalculations.length} of {run._count.calculations.toLocaleString("en-GB")})
            </span>
          </CardTitle>
          <CardDescription>
            Immutable record-level results with the exact formula applied, ordered by total CO2e.
          </CardDescription>
        </CardHeader>
        <CardContent className={largestCalculations.length === 0 ? "pb-8" : "p-0 pb-2"}>
          {largestCalculations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="font-medium text-slate-700">No calculations recorded</p>
              <p className="text-sm text-slate-500 max-w-sm">
                This run produced no record-level calculations. Check that approved activity
                records exist for the reporting period.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Record</TableHead>
                  <TableHead>Original</TableHead>
                  <TableHead>Normalised</TableHead>
                  <TableHead>Factor library</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {largestCalculations.map((calc) => (
                  <TableRow key={calc.id}>
                    <TableCell className="font-medium text-slate-900 max-w-56 truncate">
                      {calc.activityRecord.sourceDescription ??
                        calc.activityRecord.supplierName ??
                        "Activity record"}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatAmount(calc.originalAmount, calc.originalUnit)}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatAmount(calc.normalizedAmount, calc.normalizedUnit)}
                    </TableCell>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {calc.factorLibraryVersion}
                    </TableCell>
                    <TableCell
                      className="text-xs font-mono text-slate-500 max-w-md truncate"
                      title={calc.formula}
                    >
                      {calc.formula}
                    </TableCell>
                    <TableCell className="text-right text-slate-900 font-medium whitespace-nowrap">
                      {formatTonnes(Number(calc.totalCo2e))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-normal uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-red-600">You do not have permission to view this calculation run.</p>
    </div>
  );
}
