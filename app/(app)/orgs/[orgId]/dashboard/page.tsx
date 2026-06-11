import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock,
  FileText,
  Handshake,
  Inbox,
  LineChart,
  PieChart,
  Route,
  Scale,
  Target,
  TrendingUp,
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
import { ReviewTaskPanel, type ReviewTaskPanelCandidate } from "./review-task-panel";
import { resolveReviewTarget } from "@/lib/review-tasks/targets";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
}

function formatKgCo2e(value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 kgCO2e";
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)} tCO2e`;
  return `${numeric.toFixed(1)} kgCO2e`;
}

function formatNumber(value: unknown, maximumFractionDigits = 0): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits }).format(numeric);
}

function formatCurrency(value: unknown, currency = "GBP"): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "£0";
  return new Intl.NumberFormat("en-GB", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(numeric);
}

function formatPercent(complete: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((complete / total) * 100)}%`;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgId } = await params;
  const { session } = await requireOrgMember(
    orgId,
    "admin",
    "editor",
    "reviewer",
    "viewer",
    "auditor",
  );

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
    failedReportCount,
    failedCalculationCount,
    openReviewTaskCount,
    myReviewTasks,
    reviewImports,
    reviewRecords,
    reviewReports,
    reviewAssignees,
    recentAuditLogs,
    targetCount,
    initiativeCount,
    reportingPeriods,
    methodologies,
    factorLibraries,
    calculationRuns,
    evidenceFileCount,
    routeDistanceStats,
    submissionStatusRows,
    submissionDocumentRows,
    initiativeStatusRows,
    targetReductionStats,
    topCategoryAggregates,
    reportStatusRows,
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
    prisma.report.count({ where: { organizationId: orgId, status: "failed" } }),
    prisma.calculationRun.count({ where: { organizationId: orgId, status: "failed" } }),
    prisma.reviewTask.count({ where: { organizationId: orgId, status: "open" } }),
    prisma.reviewTask.findMany({
      where: {
        organizationId: orgId,
        assigneeUserId: session.user.id,
        status: "open",
      },
      include: {
        assignee: { select: { name: true, email: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.importBatch.findMany({
      where: { organizationId: orgId, state: { in: ["failed", "needs_attention"] } },
      select: {
        id: true,
        sourceFilename: true,
        state: true,
        errorCount: true,
        warningCount: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.activityRecord.findMany({
      where: { organizationId: orgId, reviewStatus: { in: ["in_review", "rejected"] } },
      include: {
        emissionCategory: { select: { scope: true, name: true } },
        reportingPeriod: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.report.findMany({
      where: { organizationId: orgId, status: "failed" },
      include: {
        reportingPeriod: { select: { label: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { in: ["admin", "editor", "reviewer"] } },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
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
    prisma.evidenceFile.count({ where: { organizationId: orgId } }),
    prisma.routeDistance.aggregate({
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { distanceKm: true },
    }),
    prisma.fieldSubmission.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.fieldSubmission.groupBy({
      by: ["documentType"],
      where: { organizationId: orgId },
      _count: { _all: true },
      orderBy: { documentType: "asc" },
    }),
    prisma.reductionInitiative.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { _all: true },
      _sum: { costAmount: true, expectedImpactCo2e: true },
      orderBy: { status: "asc" },
    }),
    prisma.reductionTarget.aggregate({
      where: { organizationId: orgId },
      _sum: { reductionAmount: true },
    }),
    currentPeriod
      ? prisma.dashboardAggregate.findMany({
          where: {
            organizationId: orgId,
            reportingPeriodId: currentPeriod.id,
            snapshotId: null,
            emissionCategoryId: { not: null },
          },
          include: {
            emissionCategory: { select: { name: true, scope: true } },
          },
          orderBy: { totalCo2e: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
    prisma.report.groupBy({
      by: ["status"],
      where: { organizationId: orgId },
      _count: { _all: true },
      orderBy: { status: "asc" },
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
  const currentFootprint = scopeRows.reduce((total, row) => total + Number(row.total), 0);
  const currentCalculatedRecords = scopeRows.reduce(
    (total, row) => total + Number(row.records),
    0,
  );
  const maxCategoryTotal = Math.max(
    ...topCategoryAggregates.map((aggregate) => Number(aggregate.totalCo2e)),
    0,
  );
  const submissionTotal = submissionStatusRows.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const documentTotal = submissionDocumentRows.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const initiativeTotalImpact = initiativeStatusRows.reduce(
    (total, row) => total + Number(row._sum.expectedImpactCo2e ?? 0),
    0,
  );
  const initiativeTotalCost = initiativeStatusRows.reduce(
    (total, row) => total + Number(row._sum.costAmount ?? 0),
    0,
  );
  const targetReductionTotal = Number(targetReductionStats._sum.reductionAmount ?? 0);
  const routeDistanceKm = Number(routeDistanceStats._sum.distanceKm ?? 0);
  const routeDistanceCount = routeDistanceStats._count._all;
  const routeAverageKm =
    routeDistanceCount > 0 ? routeDistanceKm / routeDistanceCount : 0;
  const reportStatusTotal = reportStatusRows.reduce(
    (total, row) => total + row._count._all,
    0,
  );
  const reviewTaskTargets = await Promise.all(
    myReviewTasks.map((task) =>
      resolveReviewTarget({
        organizationId: orgId,
        type: task.type,
        targetId: task.targetId,
      }),
    ),
  );
  const reviewTasks = myReviewTasks.flatMap((task, index) => {
    const target = reviewTaskTargets[index];
    if (!target) return [];
    return {
      id: task.id,
      type: task.type,
      status: task.status,
      label: target.label,
      detail: target.detail,
      href: target.href,
      assigneeLabel: task.assignee.name ?? task.assignee.email,
      createdByLabel: task.createdBy.name ?? task.createdBy.email,
      createdAt: task.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      }),
    };
  });
  const reviewCandidates: ReviewTaskPanelCandidate[] = [
    ...reviewImports.map((batch) => ({
      key: `import_batch:${batch.id}`,
      type: "import_batch" as const,
      targetId: batch.id,
      label: batch.sourceFilename,
      detail: `${batch.state.replaceAll("_", " ")} - ${batch.errorCount} errors, ${batch.warningCount} warnings`,
      href: `/orgs/${orgId}/imports`,
    })),
    ...reviewRecords.map((record) => ({
      key: `activity_record:${record.id}`,
      type: "activity_record" as const,
      targetId: record.id,
      label: record.sourceDescription ?? record.supplierName ?? "Activity record",
      detail: `Scope ${record.emissionCategory.scope} ${record.emissionCategory.name} - ${record.reviewStatus.replaceAll("_", " ")} - ${record.reportingPeriod.label}`,
      href: `/orgs/${orgId}/records`,
    })),
    ...reviewReports.map((report) => ({
      key: `report:${report.id}`,
      type: "report" as const,
      targetId: report.id,
      label: `${report.type.replaceAll("_", " ")} report`,
      detail: `${report.status.replaceAll("_", " ")} - ${report.reportingPeriod.label}`,
      href: `/orgs/${orgId}/reports`,
    })),
  ].slice(0, 8);
  const reviewAssigneeOptions = reviewAssignees.map((assignee) => ({
    id: assignee.user.id,
    label: assignee.user.name ?? assignee.user.email,
  }));
  const defaultAssigneeId =
    reviewAssigneeOptions.find((assignee) => assignee.id === session.user.id)?.id ??
    reviewAssigneeOptions[0]?.id ??
    session.user.id;

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
            <ReadinessRow
              icon={ClipboardCheck}
              label="Open review tasks"
              value={`${openReviewTaskCount}`}
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-950 text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-white">Analytics workbench</CardTitle>
                <CardDescription className="text-slate-300">
                  Category concentration and scope movement for the active reporting period.
                </CardDescription>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
                <LineChart className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Top emission categories</p>
                  <p className="text-xs text-slate-500">
                    Ranked from current calculation aggregates.
                  </p>
                </div>
                <Badge variant="outline">{currentPeriod?.label ?? "No period"}</Badge>
              </div>
              <div className="mt-4 space-y-3">
                {topCategoryAggregates.length > 0 ? (
                  topCategoryAggregates.map((aggregate) => (
                    <ProgressRow
                      key={aggregate.id}
                      label={aggregate.emissionCategory?.name ?? "Uncategorised"}
                      meta={`Scope ${aggregate.emissionCategory?.scope ?? aggregate.scope} - ${aggregate.recordCount.toLocaleString("en-GB")} records`}
                      value={formatKgCo2e(aggregate.totalCo2e)}
                      percent={
                        maxCategoryTotal > 0
                          ? (Number(aggregate.totalCo2e) / maxCategoryTotal) * 100
                          : 0
                      }
                    />
                  ))
                ) : (
                  <EmptyPanel
                    title="No category analytics yet"
                    description="Run a calculation after records are approved to rank materials, waste, haulage, fuel, and other categories."
                    href={`/orgs/${orgId}/dashboard`}
                    action="Run calculation"
                  />
                )}
              </div>
            </div>
            <div className="grid gap-3">
              <InsightCard
                icon={Scale}
                label="Calculated records"
                value={currentCalculatedRecords.toLocaleString("en-GB")}
                detail="Records included in current scope totals"
              />
              <InsightCard
                icon={BarChart3}
                label="Current footprint"
                value={formatKgCo2e(currentFootprint)}
                detail="Scope 1, 2, and 3 combined"
              />
              <InsightCard
                icon={PieChart}
                label="Scope coverage"
                value={`${scopeRows.filter((row) => Number(row.records) > 0).length}/3`}
                detail="Scopes with calculated activity"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Reporting pipeline</CardTitle>
                <CardDescription>
                  Board-pack output status across requested inventory, snapshot, and audit reports.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/orgs/${orgId}/reports`}>
                  Reports
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {reportStatusRows.length > 0 ? (
              reportStatusRows.map((row) => (
                <PipelineRow
                  key={row.status}
                  label={row.status.replaceAll("_", " ")}
                  count={row._count._all}
                  total={reportStatusTotal}
                />
              ))
            ) : (
              <EmptyPanel
                title="No report requests yet"
                description="Publish a calculation snapshot, then request inventory, monthly snapshot, or audit pack outputs."
                href={`/orgs/${orgId}/reports`}
                action="Open reports"
              />
            )}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <InsightCard
                icon={FileText}
                label="Ready outputs"
                value={readyReportCount.toLocaleString("en-GB")}
                detail="Downloadable report artefacts"
              />
              <InsightCard
                icon={AlertTriangle}
                label="Failed outputs"
                value={failedReportCount.toLocaleString("en-GB")}
                detail="Require rerun or investigation"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Social value tools</CardTitle>
                <CardDescription>
                  Track decarbonisation work, route-efficiency signals, and target ambition from live records.
                </CardDescription>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                <Handshake className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InsightCard
                icon={Target}
                label="Target ambition"
                value={formatKgCo2e(targetReductionTotal)}
                detail={`${targetCount.toLocaleString("en-GB")} active target records`}
              />
              <InsightCard
                icon={TrendingUp}
                label="Expected initiative impact"
                value={formatKgCo2e(initiativeTotalImpact)}
                detail={`${initiativeCount.toLocaleString("en-GB")} initiatives tracked`}
              />
              <InsightCard
                icon={Scale}
                label="Planned investment"
                value={formatCurrency(initiativeTotalCost)}
                detail="Cost recorded against initiatives"
              />
              <InsightCard
                icon={Route}
                label="Average route distance"
                value={`${formatNumber(routeAverageKm, 1)} km`}
                detail={`${routeDistanceCount.toLocaleString("en-GB")} postcode routes cached`}
              />
            </div>
            <div className="rounded-lg border border-slate-200">
              {initiativeStatusRows.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {initiativeStatusRows.map((row) => (
                    <div key={row.status} className="flex items-center justify-between gap-4 p-3">
                      <div>
                        <p className="text-sm font-medium capitalize text-slate-800">
                          {row.status.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatKgCo2e(row._sum.expectedImpactCo2e)} expected impact
                        </p>
                      </div>
                      <Badge variant="outline">{row._count._all}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyPanel
                  title="No social value initiatives yet"
                  description="Create initiatives for reuse, route optimisation, supplier change, waste diversion, or low-carbon materials."
                  href={`/orgs/${orgId}/targets`}
                  action="Create initiative"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Evidence and field capture</CardTitle>
                <CardDescription>
                  Submission quality, document mix, and uploaded evidence volume from mobile and web workflows.
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/orgs/${orgId}/submissions`}>
                  Submissions
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Capture status</p>
              <div className="mt-3 space-y-3">
                {submissionStatusRows.length > 0 ? (
                  submissionStatusRows.map((row) => (
                    <PipelineRow
                      key={row.status}
                      label={row.status.replaceAll("_", " ")}
                      count={row._count._all}
                      total={submissionTotal}
                    />
                  ))
                ) : (
                  <EmptyPanel
                    title="No field submissions yet"
                    description="Use the field app or API to submit delivery notes, waste tickets, and fuel evidence."
                    href={`/orgs/${orgId}/submissions`}
                    action="Open submissions"
                  />
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Document mix</p>
              <div className="mt-3 space-y-3">
                {submissionDocumentRows.length > 0 ? (
                  submissionDocumentRows.map((row) => (
                    <PipelineRow
                      key={row.documentType}
                      label={row.documentType.replaceAll("_", " ")}
                      count={row._count._all}
                      total={documentTotal}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                    Document type analytics appear when field submissions are received.
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InsightCard
                  icon={Upload}
                  label="Evidence files"
                  value={evidenceFileCount.toLocaleString("en-GB")}
                  detail="Stored and linked documents"
                />
                <InsightCard
                  icon={Route}
                  label="Route km captured"
                  value={`${formatNumber(routeDistanceKm, 1)} km`}
                  detail="Pickup to delivery distance"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Operations health</CardTitle>
          <CardDescription>
            Failed workflow signals and recent audit events from live system state.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <HealthSignal
              href={`/orgs/${orgId}/imports`}
              label="Imports needing attention"
              value={failedImportCount}
            />
            <HealthSignal
              href={`/orgs/${orgId}/reports`}
              label="Failed reports"
              value={failedReportCount}
            />
            <HealthSignal
              href={`/orgs/${orgId}/dashboard`}
              label="Failed calculations"
              value={failedCalculationCount}
            />
          </div>
          <div className="rounded-lg border border-slate-200">
            {recentAuditLogs.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
                <Clock className="h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-700">No audit events yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Operational events appear here after users create, review, calculate, or publish data.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {log.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {log.resourceType} - {log.actor?.name ?? log.actor?.email ?? "System"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-slate-400">
                      {log.createdAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Review task queue</CardTitle>
          <CardDescription>
            Assign operational exceptions and close review work with an audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewTaskPanel
            orgId={orgId}
            tasks={reviewTasks}
            candidates={reviewCandidates}
            assignees={reviewAssigneeOptions}
            defaultAssigneeId={defaultAssigneeId}
          />
        </CardContent>
      </Card>

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

function InsightCard({
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  meta,
  value,
  percent,
}: {
  label: string;
  meta: string;
  value: string;
  percent: number;
}) {
  const width = `${Math.max(2, Math.min(100, percent))}%`;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{meta}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-700" style={{ width }} />
      </div>
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  const width = `${Math.max(2, Math.min(100, percent))}%`;
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium capitalize text-slate-800">{label}</span>
        <span className="text-sm font-semibold text-slate-950">{count.toLocaleString("en-GB")}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width }} />
      </div>
    </div>
  );
}

function HealthSignal({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: number;
}) {
  const hasIssue = value > 0;
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
    >
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {hasIssue ? "Open the workflow to resolve" : "No failures recorded"}
        </p>
      </div>
      <Badge variant={hasIssue ? "destructive" : "outline"} className="gap-1">
        {hasIssue && <AlertTriangle className="h-3 w-3" />}
        {value}
      </Badge>
    </Link>
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
