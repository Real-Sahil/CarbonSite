import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  FileText,
  Inbox,
  Target,
  Upload,
} from "lucide-react";
import { requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalculationControls } from "./calculation-controls";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
}

function formatKgCo2e(value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 kgCO2e";
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)} tCO2e`;
  return `${numeric.toFixed(1)} kgCO2e`;
}

function formatPercent(complete: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((complete / total) * 100)}%`;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgId } = await params;
  await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

  const [organization, currentPeriod] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.reportingPeriod.findFirst({
      where: { organizationId: orgId },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, label: true, status: true },
    }),
  ]);

  const [
    scopeAggregates,
    recordCount,
    approvedRecordCount,
    pendingSubmissionCount,
    importCount,
    failedImportCount,
    reportCount,
    readyReportCount,
    targetCount,
    initiativeCount,
    reportingPeriods,
    methodologies,
    factorLibraries,
    calculationRuns,
  ] = await Promise.all([
    currentPeriod
      ? prisma.dashboardAggregate.groupBy({
          by: ["scope"],
          where: {
            organizationId: orgId,
            reportingPeriodId: currentPeriod.id,
            snapshotId: null,
          },
          _sum: { totalCo2e: true, recordCount: true },
          orderBy: { scope: "asc" },
        })
      : Promise.resolve([]),
    prisma.activityRecord.count({ where: { organizationId: orgId } }),
    prisma.activityRecord.count({
      where: { organizationId: orgId, reviewStatus: "approved" },
    }),
    prisma.fieldSubmission.count({
      where: {
        organizationId: orgId,
        status: { in: ["pending", "submitted", "under_review", "needs_info"] },
      },
    }),
    prisma.importBatch.count({ where: { organizationId: orgId } }),
    prisma.importBatch.count({
      where: { organizationId: orgId, state: { in: ["failed", "needs_attention"] } },
    }),
    prisma.report.count({ where: { organizationId: orgId } }),
    prisma.report.count({ where: { organizationId: orgId, status: "ready" } }),
    prisma.reductionTarget.count({ where: { organizationId: orgId } }),
    prisma.reductionInitiative.count({ where: { organizationId: orgId } }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.methodologyVersion.findMany({
      select: { id: true, name: true, gwpVersion: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.factorLibrary.findMany({
      select: { id: true, name: true, version: true },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.calculationRun.findMany({
      where: { organizationId: orgId },
      include: {
        reportingPeriod: { select: { label: true } },
        factorLibrary: { select: { name: true, version: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const scopeRows = [1, 2, 3].map((scope) => {
    const aggregate = scopeAggregates.find((row) => row.scope === scope);
    return {
      scope,
      total: aggregate?._sum.totalCo2e ?? 0,
      records: aggregate?._sum.recordCount ?? 0,
    };
  });

  const hasAggregates = scopeRows.some((row) => Number(row.total) > 0 || Number(row.records) > 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Live emissions operations for {organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {currentPeriod ? currentPeriod.label : "No reporting period"}
          </Badge>
          {currentPeriod && <Badge variant="secondary">{currentPeriod.status}</Badge>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Activity records"
          value={recordCount.toLocaleString("en-GB")}
          detail={`${formatPercent(approvedRecordCount, recordCount)} approved`}
        />
        <MetricCard
          icon={Inbox}
          label="Open field submissions"
          value={pendingSubmissionCount.toLocaleString("en-GB")}
          detail="Awaiting triage or reviewer action"
        />
        <MetricCard
          icon={Upload}
          label="Import batches"
          value={importCount.toLocaleString("en-GB")}
          detail={failedImportCount > 0 ? `${failedImportCount} need attention` : "No failed imports"}
        />
        <MetricCard
          icon={FileText}
          label="Reports"
          value={readyReportCount.toLocaleString("en-GB")}
          detail={`${reportCount.toLocaleString("en-GB")} total requested`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emissions by scope</CardTitle>
            <CardDescription>
              Aggregates rebuilt from immutable calculation runs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasAggregates ? (
              <div className="grid gap-3 md:grid-cols-3">
                {scopeRows.map((row) => (
                  <div key={row.scope} className="rounded-lg border border-slate-200 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Scope {row.scope}
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatKgCo2e(row.total)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {Number(row.records).toLocaleString("en-GB")} calculated records
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel
                title="No calculated aggregates yet"
                description="Import or approve activity data, then run a calculation to populate scope totals."
                href={`/orgs/${orgId}/imports`}
                action="Start an import"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production readiness</CardTitle>
            <CardDescription>
              Operational signals that must stay real in production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ReadinessRow
              icon={ClipboardCheck}
              label="Approved record coverage"
              value={formatPercent(approvedRecordCount, recordCount)}
            />
            <ReadinessRow
              icon={Target}
              label="Targets and initiatives"
              value={`${targetCount + initiativeCount}`}
            />
            <ReadinessRow
              icon={Inbox}
              label="Open submissions"
              value={`${pendingSubmissionCount}`}
            />
            <div className="pt-3">
              <Button asChild size="sm">
                <Link href={`/orgs/${orgId}/submissions`}>
                  Review submissions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Calculations and snapshots</CardTitle>
          <CardDescription>
            Run calculations from approved records, then publish a snapshot for reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <CalculationControls
            orgId={orgId}
            periods={reportingPeriods}
            methodologies={methodologies.map((item) => ({
              id: item.id,
              label: `${item.name} (${item.gwpVersion})`,
            }))}
            factorLibraries={factorLibraries.map((item) => ({
              id: item.id,
              label: `${item.name} ${item.version}`,
            }))}
            succeededRuns={calculationRuns
              .filter((run) => run.status === "succeeded")
              .map((run) => ({
                id: run.id,
                status: run.status,
                label: `${run.reportingPeriod.label} - ${run.factorLibrary.name} ${run.factorLibrary.version}`,
              }))}
          />
          {calculationRuns.length > 0 && (
            <div className="grid gap-2">
              {calculationRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {run.reportingPeriod.label}
                    </p>
                    <p className="text-xs text-slate-500">
                      {run.factorLibrary.name} {run.factorLibrary.version}
                    </p>
                  </div>
                  <Badge variant={run.status === "succeeded" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                    {run.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 mt-6 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard title="Records" description="Review committed activity data and evidence status." href={`/orgs/${orgId}/records`} />
        <ActionCard title="Imports" description="Upload, validate, and commit activity data batches." href={`/orgs/${orgId}/imports`} />
        <ActionCard title="Reports" description="Track report requests and signed output artefacts." href={`/orgs/${orgId}/reports`} />
        <ActionCard title="Targets" description="Manage reduction targets and operational initiatives." href={`/orgs/${orgId}/targets`} />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-slate-500">{description}</p>
      <Button asChild size="sm" className="mt-4">
        <Link href={href}>{action}</Link>
      </Button>
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
