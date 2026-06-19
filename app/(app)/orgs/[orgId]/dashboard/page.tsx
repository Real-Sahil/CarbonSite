import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  Handshake,
  Inbox,
  Leaf,
  LineChart,
  ListChecks,
  PieChart,
  Route,
  Scale,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalculationControls } from "./calculation-controls";
import { ReviewTaskPanel, type ReviewTaskPanelCandidate } from "./review-task-panel";
import { resolveReviewTarget } from "@/lib/review-tasks/targets";
import { ScopeDonut } from "@/components/charts/scope-donut";
import { CategoryBar } from "@/components/charts/category-bar";
import { TrendLine, type TrendLineDatum } from "@/components/charts/trend-line";
import { OnboardingChecklist } from "./onboarding-checklist";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ facilityId?: string; contractId?: string }>;
}

function formatKgCo2e(value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 kgCO2e";
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(2)} tCO2e`;
  return `${numeric.toFixed(1)} kgCO2e`;
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

export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { orgId } = await params;
  const { facilityId: selectedFacilityId, contractId: selectedContractId } = await searchParams;
  const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

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

  // Contract filter support
  const [activeContracts, selectedContract] = await Promise.all([
    prisma.contract.findMany({
      where: { organizationId: orgId, status: "active" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    selectedContractId
      ? prisma.contract.findUnique({
          where: { id: selectedContractId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  // Get facilityIds linked to the selected contract via sites → activity records
  let contractFacilityIds: string[] | null = null;
  if (selectedContractId) {
    const rows = await prisma.$queryRaw<Array<{ facility_id: string }>>`
      SELECT DISTINCT ar.facility_id
      FROM activity_records ar
      INNER JOIN sites s ON s.id = ar.site_id
      INNER JOIN projects p ON p.id = s.project_id
      WHERE p.contract_id = ${selectedContractId}
        AND ar.organization_id = ${orgId}
        AND ar.facility_id IS NOT NULL
    `;
    contractFacilityIds = rows.map((r) => r.facility_id);
  }

  // Latest succeeded calculation run (used for data quality metrics)
  const latestSucceededRun = await prisma.calculationRun.findFirst({
    where: { organizationId: orgId, status: "succeeded" },
    orderBy: { createdAt: "desc" },
    select: { id: true, finishedAt: true, reportingPeriodId: true },
  });

  // Split into two parallel batches to stay within TypeScript's Promise.all tuple inference limit
  const [batchA, batchB, trendAggregates, facilityAggregates, dataQualityBatch] = await Promise.all([
    Promise.all([
      currentPeriod
        ? prisma.dashboardAggregate.groupBy({
            by: ["scope"],
            where: {
              organizationId: orgId,
              reportingPeriodId: currentPeriod.id,
              snapshotId: null,
              ...(contractFacilityIds !== null
                ? { facilityId: { in: contractFacilityIds } }
                : {}),
            },
            _sum: { totalCo2e: true, recordCount: true },
            orderBy: { scope: "asc" },
          })
        : Promise.resolve([] as { scope: number; _sum: { totalCo2e: string | null; recordCount: number | null } }[]),
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
    ] as const),
    Promise.all([
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
        : Promise.resolve([] as { id: string; scope: number; totalCo2e: string; recordCount: number; emissionCategory: { name: string; scope: number } | null }[]),
      prisma.report.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      prisma.socialValueRecord.aggregate({
        where: { organizationId: orgId },
        _sum: { valuePounds: true },
        _count: { _all: true },
      }),
    ] as const),
    // Period trend: live scope-level aggregates across all reporting periods.
    // Reads DashboardAggregate only — never raw EmissionCalculation rows.
    prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId: null,
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
      },
      select: {
        scope: true,
        totalCo2e: true,
        reportingPeriod: { select: { id: true, label: true, startDate: true } },
      },
    }),
    // Facility breakdowns for the current period (live, no snapshot)
    currentPeriod
      ? prisma.dashboardAggregate.findMany({
          where: {
            organizationId: orgId,
            reportingPeriodId: currentPeriod.id,
            snapshotId: null,
            emissionCategoryId: null,
            businessUnitId: null,
            facilityId: { not: null },
          },
          include: {
            facility: { select: { id: true, name: true } },
          },
          orderBy: { totalCo2e: "desc" },
        })
      : Promise.resolve(
          [] as {
            id: string;
            facilityId: string | null;
            totalCo2e: string | { toNumber: () => number };
            recordCount: number;
            facility: { id: string; name: string } | null;
          }[],
        ),
    // Data quality metrics
    Promise.all([
      // Total CO2e for all records in the latest calculation run
      latestSucceededRun
        ? prisma.emissionCalculation.aggregate({
            where: { calculationRunId: latestSucceededRun.id, organizationId: orgId },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
      // CO2e for approved records only (join via activityRecord reviewStatus)
      latestSucceededRun
        ? prisma.emissionCalculation.aggregate({
            where: {
              calculationRunId: latestSucceededRun.id,
              organizationId: orgId,
              activityRecord: { reviewStatus: "approved" },
            },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
      // Approved records missing evidence (no ActivityRecordEvidence rows)
      prisma.activityRecord.count({
        where: {
          organizationId: orgId,
          reviewStatus: "approved",
          evidence: { none: {} },
        },
      }),
      // Records needing attention (in_review or draft)
      prisma.activityRecord.count({
        where: {
          organizationId: orgId,
          reviewStatus: { in: ["in_review", "draft"] },
        },
      }),
      // Signal 1: records added after last calculation run (stale warning)
      latestSucceededRun?.finishedAt && latestSucceededRun.reportingPeriodId
        ? prisma.activityRecord.count({
            where: {
              organizationId: orgId,
              reportingPeriodId: latestSucceededRun.reportingPeriodId,
              createdAt: { gt: latestSucceededRun.finishedAt },
            },
          })
        : Promise.resolve(0),
      // Signal 2: fallback factor exposure — CO2e from fallback selections
      latestSucceededRun
        ? prisma.emissionCalculation.aggregate({
            where: {
              calculationRunId: latestSucceededRun.id,
              organizationId: orgId,
              selectionReason: { contains: "fallback", mode: "insensitive" },
            },
            _sum: { totalCo2e: true },
          })
        : Promise.resolve({ _sum: { totalCo2e: null } }),
      // Signal 3: approved field submissions with both ocrExtractedData and formData set
      prisma.fieldSubmission.findMany({
        where: {
          organizationId: orgId,
          status: "approved",
          ocrExtractedData: { not: Prisma.JsonNull },
          formData: { not: Prisma.JsonNull },
        },
        select: { ocrExtractedData: true, formData: true },
      }),
    ] as const),
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
  ] = batchA;

  const [
    reviewAssignees,
    recentAuditLogs,
    targetCount,
    initiativeCount,
    reportingPeriods,
    methodologies,
    factorLibraries,
    calculationRuns,
    evidenceFileCount,
    submissionStatusRows,
    submissionDocumentRows,
    initiativeStatusRows,
    targetReductionStats,
    topCategoryAggregates,
    reportStatusRows,
    socialValueStats,
  ] = batchB;

  const [totalCo2eAgg, approvedCo2eAgg, missingEvidenceCount, pendingAttentionCount, staleRecordCount, fallbackCo2eAgg, ocrDiscrepancySubmissions] =
    dataQualityBatch;

  const totalCalcCo2e = Number(totalCo2eAgg._sum.totalCo2e ?? 0);
  const approvedCalcCo2e = Number(approvedCo2eAgg._sum.totalCo2e ?? 0);
  const dataConfidencePct =
    totalCalcCo2e > 0 ? Math.round((approvedCalcCo2e / totalCalcCo2e) * 100) : null;

  // Signal 2: fallback factor exposure percentage
  const fallbackCo2e = Number(fallbackCo2eAgg._sum.totalCo2e ?? 0);
  const fallbackPct = totalCalcCo2e > 0 ? Math.round((fallbackCo2e / totalCalcCo2e) * 100) : 0;

  // Signal 3: OCR vs formData discrepancy count
  const ocrDiscrepancyCount = ocrDiscrepancySubmissions.filter((sub) => {
    try {
      const ocr = sub.ocrExtractedData as Record<string, unknown>;
      const form = sub.formData as Record<string, unknown>;
      const sharedKeys = Object.keys(ocr).filter((k) => k in form);
      return sharedKeys.some((k) => {
        const oVal = Number(ocr[k]);
        const fVal = Number(form[k]);
        if (!Number.isFinite(oVal) || !Number.isFinite(fVal) || fVal === 0) return false;
        return Math.abs(oVal - fVal) / Math.abs(fVal) > 0.1;
      });
    } catch {
      return false;
    }
  }).length;

  // Facility breakdown derived values
  const facilityRows = facilityAggregates.map((agg) => ({
    id: agg.facilityId ?? "",
    name: agg.facility?.name ?? "Unknown facility",
    totalCo2e: Number(agg.totalCo2e),
    recordCount: agg.recordCount,
  }));
  const facilityTotal = facilityRows.reduce((sum, row) => sum + row.totalCo2e, 0);
  const activeFacility = selectedFacilityId
    ? facilityRows.find((row) => row.id === selectedFacilityId) ?? null
    : null;

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

  // Chart data — Prisma Decimals converted to numbers server-side (values are kgCO2e).
  const scopeDonutData = scopeRows.map((row) => ({
    scope: row.scope,
    label: `Scope ${row.scope}`,
    value: Number(row.total),
  }));
  const categoryBarData = topCategoryAggregates.map((aggregate) => ({
    name: aggregate.emissionCategory?.name ?? "Uncategorised",
    scope: aggregate.emissionCategory?.scope ?? aggregate.scope,
    value: Number(aggregate.totalCo2e),
  }));
  const trendByPeriod = new Map<
    string,
    { startDate: Date; datum: TrendLineDatum }
  >();
  for (const aggregate of trendAggregates) {
    const period = aggregate.reportingPeriod;
    let entry = trendByPeriod.get(period.id);
    if (!entry) {
      entry = {
        startDate: period.startDate,
        datum: { label: period.label, scope1: 0, scope2: 0, scope3: 0 },
      };
      trendByPeriod.set(period.id, entry);
    }
    if (aggregate.scope === 1) entry.datum.scope1 += Number(aggregate.totalCo2e);
    if (aggregate.scope === 2) entry.datum.scope2 += Number(aggregate.totalCo2e);
    if (aggregate.scope === 3) entry.datum.scope3 += Number(aggregate.totalCo2e);
  }
  const trendData = [...trendByPeriod.values()]
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
    .map((entry) => entry.datum);
  const showTrend = trendData.length >= 2;

  // Period-over-period change for the carbon hero, from live scope aggregates.
  // Suppressed under a contract filter because the trend series is org-wide.
  const trendTotals = trendData.map((d) => d.scope1 + d.scope2 + d.scope3);
  const latestTrendTotal = trendTotals.length > 0 ? trendTotals[trendTotals.length - 1] : 0;
  const previousTrendTotal = trendTotals.length > 1 ? trendTotals[trendTotals.length - 2] : null;
  const periodDeltaPct =
    !selectedContractId && previousTrendTotal && previousTrendTotal > 0
      ? ((latestTrendTotal - previousTrendTotal) / previousTrendTotal) * 100
      : null;
  const scopesWithActivity = scopeRows.filter((row) => Number(row.records) > 0).length;

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
    <div className="p-[42px] max-w-[1200px] mx-auto">
      <div className="mb-[42px] flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
            Overview
          </p>
          <h1
            className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
            style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
          >
            Dashboard
          </h1>
          <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
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

      <OnboardingChecklist
        orgId={orgId}
        steps={[
          {
            label: "Reporting periods",
            description: "Define your inventory years or quarters",
            href: `/orgs/${orgId}/settings/operations`,
            done: reportingPeriods.length > 0,
          },
          {
            label: "Emission factors",
            description: "Import DEFRA, EPA, or SustainMetrics factors",
            href: `/orgs/${orgId}/settings/operations`,
            done: factorLibraries.length > 0,
          },
          {
            label: "Activity data",
            description: "Import CSV or add records manually",
            href: `/orgs/${orgId}/imports`,
            done: recordCount > 0 || importCount > 0,
          },
          {
            label: "Run calculation",
            description: "Convert activity data to CO2e",
            href: `/orgs/${orgId}/calculations`,
            done: calculationRuns.some((r) => r.status === "succeeded"),
          },
          {
            label: "Generate report",
            description: "Publish a snapshot and export",
            href: `/orgs/${orgId}/reports`,
            done: readyReportCount > 0,
          },
        ]}
      />

      {/* Contract filter */}
      {activeContracts.length > 0 && (
        <div className="flex flex-col gap-3">
          {selectedContract && (
            <div className="flex items-center gap-2 rounded-[14px] border border-[#b6ced5] bg-[#b6ced5]/20 px-4 py-3">
              <span className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                Filtering by contract: <strong>{selectedContract.name}</strong>
              </span>
              <Link
                href={`/orgs/${orgId}/dashboard`}
                className="ml-auto text-xs text-[#333333] underline hover:text-[#0f3e17]"
              >
                Clear
              </Link>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-normal text-[#333333] tracking-[-0.36px] mr-1">Filter by contract:</span>
            <Link
              href={`/orgs/${orgId}/dashboard`}
              className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                !selectedContractId
                  ? "bg-[#0f3e17] text-[#fffefc]"
                  : "border border-[#e5e7eb] text-[#333333] hover:border-[#b1dbb8] hover:bg-[#e1f4df]"
              }`}
            >
              All
            </Link>
            {activeContracts.map((contract) => (
              <Link
                key={contract.id}
                href={`/orgs/${orgId}/dashboard?contractId=${contract.id}`}
                className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                  selectedContractId === contract.id
                    ? "bg-[#0f3e17] text-[#fffefc]"
                    : "border border-[#e5e7eb] text-[#333333] hover:border-[#b1dbb8] hover:bg-[#e1f4df]"
                }`}
              >
                {contract.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Carbon footprint hero ─────────────────────────────────────────── */}
      <section
        aria-label="Carbon footprint summary"
        className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-[14px] border border-[#0f3e17] bg-[#0f3e17] p-[21px] text-[#fffefc] md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Leaf aria-hidden="true" className="h-4 w-4 text-[#b1dbb8]" />
            <p className="text-xs font-normal uppercase tracking-wide text-[#b1dbb8]">
              Total footprint
            </p>
          </div>
          <p className="mt-3 text-4xl font-normal tracking-[-0.4px]">
            {currentFootprint > 0 ? formatKgCo2e(currentFootprint) : "—"}
          </p>
          <p className="mt-1 text-xs text-[#b1dbb8] tracking-[-0.36px]">
            {currentFootprint > 0
              ? `Scopes 1–3 · ${currentPeriod?.label ?? "current period"}`
              : "Run a calculation to populate your footprint"}
          </p>
        </div>

        <HeroStat
          icon={periodDeltaPct !== null && periodDeltaPct <= 0 ? TrendingDown : TrendingUp}
          label="Period change"
          value={
            periodDeltaPct !== null
              ? `${periodDeltaPct > 0 ? "+" : ""}${periodDeltaPct.toFixed(1)}%`
              : "—"
          }
          detail={
            selectedContractId
              ? "Clear the contract filter to compare"
              : periodDeltaPct !== null
                ? "vs previous reporting period"
                : "Calculate a second period to compare"
          }
          tone={periodDeltaPct === null ? "neutral" : periodDeltaPct <= 0 ? "good" : "bad"}
        />

        <HeroStat
          icon={Gauge}
          label="Scope coverage"
          value={`${scopesWithActivity}/3`}
          detail={`${currentCalculatedRecords.toLocaleString("en-GB")} calculated records`}
        />

        {targetCount > 0 ? (
          <HeroStat
            icon={Target}
            label="Target ambition"
            value={formatKgCo2e(targetReductionTotal)}
            detail={`${targetCount.toLocaleString("en-GB")} active reduction target${targetCount !== 1 ? "s" : ""}`}
            href={`/orgs/${orgId}/targets`}
          />
        ) : (
          <Link
            href={`/orgs/${orgId}/targets`}
            className="group flex flex-col justify-between rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-[21px] transition-colors hover:bg-[#d4efd2]"
          >
            <div className="flex items-center gap-2">
              <Target aria-hidden="true" className="h-4 w-4 text-[#0f3e17]" />
              <p className="text-xs font-normal uppercase tracking-wide text-[#0f3e17]">
                Reduction target
              </p>
            </div>
            <div className="mt-3">
              <p className="text-base font-normal text-[#0f3e17] tracking-[-0.42px]">
                Set your first target
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#333333] tracking-[-0.36px]">
                Define a baseline and goal
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              </p>
            </div>
          </Link>
        )}
      </section>

      <p className="mt-8 mb-3 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        Operations
      </p>

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

      {hasAggregates && (
        <div
          className={`mt-6 grid gap-6 lg:grid-cols-2 ${showTrend ? "xl:grid-cols-3" : ""}`}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scope breakdown</CardTitle>
              <CardDescription>
                {currentPeriod ? currentPeriod.label : "Current period"} totals by GHG Protocol scope.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScopeDonut data={scopeDonutData} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top categories</CardTitle>
              <CardDescription>
                Largest emission categories from current calculation aggregates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryBar
                data={categoryBarData}
                ariaLabel="Top emission categories bar chart"
              />
            </CardContent>
          </Card>
          {showTrend && (
            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Period trend</CardTitle>
                <CardDescription>
                  Scope totals across reporting periods with calculated aggregates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendLine data={trendData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {facilityRows.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 aria-hidden="true" className="h-4 w-4 text-[#0f3e17]" />
                  <CardTitle className="text-base">By facility</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  CO₂e breakdown by facility for the current reporting period.
                  {activeFacility && (
                    <span className="ml-1 font-normal text-[#0f3e17]">
                      Filtered: {activeFacility.name}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/orgs/${orgId}/dashboard`}
                  className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                    !selectedFacilityId
                      ? "bg-[#0f3e17] text-[#fffefc]"
                      : "border border-[#e5e7eb] text-[#333333] hover:border-[#b1dbb8] hover:bg-[#e1f4df]"
                  }`}
                >
                  All
                </Link>
                {facilityRows.map((fac) => (
                  <Link
                    key={fac.id}
                    href={`/orgs/${orgId}/dashboard?facilityId=${fac.id}`}
                    className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                      selectedFacilityId === fac.id
                        ? "bg-[#0f3e17] text-[#fffefc]"
                        : "border border-[#e5e7eb] text-[#333333] hover:border-[#b1dbb8] hover:bg-[#e1f4df]"
                    }`}
                  >
                    {fac.name}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[14px] border border-[#e5e7eb]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
                    <th className="px-4 py-3 text-left text-xs font-normal uppercase tracking-wide text-[#333333]">
                      Facility
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#333333]">
                      Total CO₂e
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#333333]">
                      Share
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#333333]">
                      Records
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e7eb]">
                  {(activeFacility ? [activeFacility] : facilityRows).map((fac) => {
                    const share =
                      facilityTotal > 0
                        ? Math.round((fac.totalCo2e / facilityTotal) * 100)
                        : 0;
                    return (
                      <tr
                        key={fac.id}
                        className={
                          selectedFacilityId === fac.id ? "bg-[#e1f4df]/40" : "hover:bg-[#f9fafb]"
                        }
                      >
                        <td className="px-4 py-3 font-normal text-[#0f3e17] tracking-[-0.42px]">
                          {fac.name}
                        </td>
                        <td className="px-4 py-3 text-right font-normal text-[#0f3e17] tracking-[-0.42px]">
                          {formatKgCo2e(fac.totalCo2e)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#e1f4df]">
                              <div
                                className="h-full rounded-full bg-[#0f3e17]"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-[#333333] tracking-[-0.36px]">
                              {share}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[#333333] tracking-[-0.36px]">
                          {fac.recordCount.toLocaleString("en-GB")}
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emissions by scope</CardTitle>
            <CardDescription>
              Aggregates rebuilt from immutable calculation runs.
              {activeFacility && (
                <span className="ml-1 font-normal text-[#0f3e17]">
                  Showing all scopes — facility filter applies to the breakdown table above.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasAggregates ? (
              <div className="grid gap-3 md:grid-cols-3">
                {scopeRows.map((row) => (
                  <div key={row.scope} className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
                    <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">
                      Scope {row.scope}
                    </p>
                    <p className="mt-2 text-2xl font-normal tracking-[-0.4px] text-[#0f3e17]">
                      {formatKgCo2e(row.total)}
                    </p>
                    <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
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

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#0f3e17]" />
                <CardTitle className="text-base">Data quality</CardTitle>
              </div>
              <CardDescription className="mt-1">
                Confidence signals derived from record review status and evidence completeness.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#333333]">
                Emissions from reviewed records
              </dt>
              {dataConfidencePct !== null ? (
                <>
                  <dd className="mt-2 text-2xl font-normal tracking-[-0.4px] text-[#0f3e17]">
                    {dataConfidencePct}%
                  </dd>
                  <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
                    of calculated CO₂e from approved records
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e5e7eb]">
                    <div
                      className={`h-full rounded-full ${
                        dataConfidencePct >= 90
                          ? "bg-emerald-600"
                          : dataConfidencePct >= 50
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${dataConfidencePct}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <dd className="mt-2 text-2xl font-normal tracking-[-0.4px] text-[#333333]">
                    —
                  </dd>
                  <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
                    Run a calculation to see confidence
                  </p>
                </>
              )}
            </div>

            <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#333333]">
                Approved records missing evidence
              </dt>
              <dd
                className={`mt-2 text-2xl font-normal tracking-[-0.4px] ${
                  missingEvidenceCount > 0 ? "text-amber-600" : "text-[#0f3e17]"
                }`}
              >
                {missingEvidenceCount.toLocaleString("en-GB")}
              </dd>
              <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
                Approved records with no linked evidence files
              </p>
            </div>

            <div className="rounded-[14px] border border-[#e5e7eb] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#333333]">
                Records pending attention
              </dt>
              <dd
                className={`mt-2 text-2xl font-normal tracking-[-0.4px] ${
                  pendingAttentionCount > 0 ? "text-amber-600" : "text-[#0f3e17]"
                }`}
              >
                {pendingAttentionCount.toLocaleString("en-GB")}
              </dd>
              <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
                Records in draft or in review status
              </p>
              {pendingAttentionCount > 0 && (
                <div className="mt-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/orgs/${orgId}/records`}>
                      Review records
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </dl>

          {/* Deeper signals */}
          <div className="mt-4 flex flex-col gap-2">
            {staleRecordCount > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {staleRecordCount} record{staleRecordCount !== 1 ? "s" : ""} added since last calculation run — results may be outdated.
              </div>
            )}
            {fallbackPct > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {fallbackPct}% of emissions from fallback factors.
              </div>
            )}
            {ocrDiscrepancyCount > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {ocrDiscrepancyCount} approved submission{ocrDiscrepancyCount !== 1 ? "s" : ""} have OCR vs form data discrepancies.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[#e5e7eb] bg-[#0f3e17] text-[#fffefc]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-[#fffefc]">Analytics workbench</CardTitle>
                <CardDescription className="text-[#b1dbb8]">
                  Category concentration and scope movement for the active reporting period.
                </CardDescription>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-white/10 text-[#b1dbb8]">
                <LineChart aria-hidden="true" className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">Top emission categories</p>
                  <p className="text-xs text-[#333333] tracking-[-0.36px]">
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
                    href="#run-calculation"
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
              <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#e1f4df] text-[#0f3e17]">
                <Handshake aria-hidden="true" className="h-5 w-5" />
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
                icon={Handshake}
                label="TOMS social value"
                value={formatCurrency(socialValueStats._sum.valuePounds ?? 0)}
                detail={`${socialValueStats._count._all.toLocaleString("en-GB")} TOMS records`}
              />
              <InsightCard
                icon={Route}
                label="Pending submissions"
                value={pendingSubmissionCount.toLocaleString("en-GB")}
                detail="Awaiting review from field workers"
              />
            </div>
            <div className="rounded-[14px] border border-[#e5e7eb]">
              {initiativeStatusRows.length > 0 ? (
                <div className="divide-y divide-[#e5e7eb]">
                  {initiativeStatusRows.map((row) => (
                    <div key={row.status} className="flex items-center justify-between gap-4 p-3">
                      <div>
                        <p className="text-sm font-normal capitalize text-[#0f3e17] tracking-[-0.42px]">
                          {row.status.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-[#333333] tracking-[-0.36px]">
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
              <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">Capture status</p>
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
              <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">Document mix</p>
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
                  <div className="rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-5 text-sm text-[#222222] tracking-[-0.42px]">
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
                  label="Field submissions"
                  value={pendingSubmissionCount.toLocaleString("en-GB")}
                  detail="Pending review"
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
              href={`/orgs/${orgId}/calculations`}
              label="Failed calculations"
              value={failedCalculationCount}
            />
          </div>
          <div className="rounded-[14px] border border-[#e5e7eb]">
            {recentAuditLogs.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
                <Clock aria-hidden="true" className="h-6 w-6 text-[#333333]" />
                <p className="mt-2 text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">No audit events yet</p>
                <p className="mt-1 text-xs text-[#222222] tracking-[-0.36px]">
                  Operational events appear here after users create, review, calculate, or publish data.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e5e7eb]">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                        {log.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">
                        {log.resourceType} - {log.actor?.name ?? log.actor?.email ?? "System"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-[#333333] tracking-[-0.36px]">
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Review task queue</CardTitle>
              <CardDescription>
                Assign operational exceptions and close review work with an audit trail.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/orgs/${orgId}/tasks`}>
                <ListChecks className="h-4 w-4" />
                All tasks
              </Link>
            </Button>
          </div>
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

      <Card id="run-calculation" className="mt-6 scroll-mt-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Run a calculation</CardTitle>
              <CardDescription>
                Convert approved activity records into CO₂e for a reporting period. Each run is
                immutable and fully traceable.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/orgs/${orgId}/calculations`}>
                All runs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {calculationRuns.some((run) => run.status === "queued" || run.status === "running") && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[#b6ced5] bg-[#b6ced5]/20 px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-[#0f3e17] animate-pulse" />
              <div>
                <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                  Calculation in progress
                </p>
                <p className="text-xs text-[#333333] tracking-[-0.36px]">
                  {calculationRuns.filter((run) => run.status === "queued" || run.status === "running").length} run
                  {calculationRuns.filter((run) => run.status === "queued" || run.status === "running").length !== 1 ? "s" : ""} queued or running — refresh to check for results.
                </p>
              </div>
            </div>
          )}
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
                  className="flex flex-col gap-2 rounded-[14px] border border-[#e5e7eb] p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">
                      {run.reportingPeriod.label}
                    </p>
                    <p className="text-xs text-[#333333] tracking-[-0.36px]">
                      {run.factorLibrary.name} {run.factorLibrary.version}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(run.status === "queued" || run.status === "running") && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#0f3e17] animate-pulse" />
                    )}
                    <Badge variant={run.status === "succeeded" ? "default" : run.status === "failed" ? "destructive" : "outline"}>
                      {run.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
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

function HeroStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "bad" | "neutral";
  href?: string;
}) {
  const valueColor =
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-[#0f3e17]";
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#333333]" />
        <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">{label}</p>
      </div>
      <p className={`mt-3 text-3xl font-normal tracking-[-0.4px] ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">{detail}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] p-[21px] transition-colors hover:border-[#b1dbb8] hover:bg-[#e1f4df]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] p-[21px]">{inner}</div>
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
    <div className="rounded-[14px] border border-[#e5e7eb] bg-[#fffefc] p-[21px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-[#333333]">{label}</p>
          <p className="mt-2 text-xl font-normal tracking-[-0.4px] text-[#0f3e17]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-[#333333] tracking-[-0.36px]">{detail}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[#e1f4df] text-[#0f3e17]">
          <Icon aria-hidden="true" className="h-4 w-4" />
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
    <div className="rounded-[14px] border border-[#e5e7eb] p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">{label}</p>
          <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">{meta}</p>
        </div>
        <p className="shrink-0 text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e1f4df]">
        <div className="h-full rounded-full bg-[#0f3e17]" style={{ width }} />
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
    <div className="rounded-[14px] border border-[#e5e7eb] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-normal capitalize text-[#222222] tracking-[-0.42px]">{label}</span>
        <span className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">{count.toLocaleString("en-GB")}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e1f4df]">
        <div className="h-full rounded-full bg-[#0f3e17]" style={{ width }} />
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
      className="flex items-center justify-between rounded-[14px] border border-[#e5e7eb] p-[21px] transition-colors hover:bg-[#e1f4df]"
    >
      <div>
        <p className="text-sm font-normal text-[#222222] tracking-[-0.42px]">{label}</p>
        <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">
          {hasIssue ? "Open the workflow to resolve" : "No failures recorded"}
        </p>
      </div>
      <Badge variant={hasIssue ? "destructive" : "outline"} className="gap-1">
        {hasIssue && <AlertTriangle aria-hidden="true" className="h-3 w-3" />}
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
      <CardContent className="p-[21px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-normal text-[#333333] tracking-[-0.42px]">{label}</p>
            <p className="mt-2 text-3xl font-normal tracking-[-0.4px] text-[#0f3e17]">{value}</p>
            <p className="mt-1 text-xs text-[#333333] tracking-[-0.36px]">{detail}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#e1f4df] text-[#0f3e17]">
            <Icon aria-hidden="true" className="h-5 w-5" />
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
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#e5e7eb] p-3">
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#333333]" />
        <span className="text-sm text-[#222222] tracking-[-0.42px]">{label}</span>
      </div>
      <span className="text-sm font-normal text-[#0f3e17] tracking-[-0.42px]">{value}</span>
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
    <div className="rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-[21px]">
      <p className="font-normal text-[#0f3e17] tracking-[-0.42px]">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-[#222222] tracking-[-0.42px]">{description}</p>
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
      <Card className="h-full transition-colors group-hover:border-[#b1dbb8] group-hover:bg-[#e1f4df]">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
