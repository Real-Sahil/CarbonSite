export const dynamic = "force-dynamic";

import { currentFactorLibraries, supersedingLibrary } from "@/lib/calculation/library-for-period";
import { outdatedMethodology } from "@/lib/calculation/methodology";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Clock,
  Download,
  Droplets,
  Trash2,
  FileText,
  Gauge,
  Handshake,
  Inbox,
  Layers,
  LayoutDashboard,
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
import { redirect } from "next/navigation";
import { getSelectedProject } from "@/lib/project/selected";
import { WasteKpisWidget } from "@/components/waste/waste-kpis-widget";
import { requireOrgMember, AuthError, ROLE_GROUPS } from "@/lib/auth/session";
import {
  CATEGORY_BY_FACILITY_DIMENSIONS,
  PRIMARY_SCOPE2_METHOD,
  SCOPE_ROLLUP_DIMENSIONS,
} from "@/lib/calculation/aggregate-filters";
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
import { BklitScopeRing } from "@/components/charts/bklit-scope-ring";
import { BklitCategoryBar } from "@/components/charts/bklit-category-bar";
import { BklitTrendArea, type TrendLineDatum } from "@/components/charts/bklit-trend-area";
import { BklitDataGauge } from "@/components/charts/bklit-data-gauge";
import { CalculationRunsLive } from "./calculation-runs-live";
import { LiveDashboard } from "@/components/dashboard/LiveDashboard";
import { hasFeature } from "@/lib/billing/limits";
import { OnboardingChecklist } from "./onboarding-checklist";
import { appraisalPrice, coveredCost, formatMoney, PRICE_TYPES, type PriceType } from "@/lib/carbon-price";
import { loadCarbonPrices } from "@/lib/carbon-price/load";
import { orgFormat } from "@/lib/i18n/org-format";
import { facilityCountries, facilityScope } from "@/lib/dashboard/group-scope";
import { loadPeriodCategoryTotals, loadSliceScopes, loadSliceTrend, loadSliceView, parseSliceFilter, resolveSliceRefs, socialValueBeside, type SliceRefs } from "@/lib/dashboard/slice-filter";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { loadStoredLayout } from "@/lib/dashboard/layout-store";
import { resolveLayout, widgetsForRole } from "@/lib/dashboard/widgets";
import { ActiveCrossFilters, LinkedSankey, LinkedWaterfall } from "@/components/dashboard/cross-filter";
import { buildWaterfall } from "@/lib/charts/waterfall";
import { DashboardFilterBar } from "@/components/dashboard/dashboard-filter-bar";
import { countryOf } from "@/lib/i18n/countries";
import { SavedViewsMenu } from "@/components/saved-views/saved-views-menu";
import { activeFilters } from "@/lib/saved-views";
import { mayShare, viewRoles } from "@/lib/saved-views/roles";
import { loadDashboardCounts, loadLatestRunStats, loadPublishedLibraries } from "@/lib/dashboard/page-data";

interface DashboardPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ facilityId?: string; contractId?: string; entityId?: string; country?: string; supplier?: string; from?: string; to?: string; scope?: string; projectId?: string; sv?: string; categoryId?: string }>;
}

function formatKgCo2e(locale: string, value: unknown): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric === 0) return "0 kgCO₂e";
  if (numeric >= 1000) return `${(numeric / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tCO₂e`;
  return `${numeric.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kgCO₂e`;
}


function formatCurrency(locale: string, value: unknown, currency = "GBP"): string {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat(locale, {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

function formatPercent(complete: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((complete / total) * 100)}%`;
}


export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  const { orgId } = await params;
  const rawParams = await searchParams;
  // A bare dashboard link opens on the project picked in the sidebar. Choosing "All projects"
  // clears that preference first, so removing the project filter does not bring it back.
  if (Object.keys(rawParams).length === 0) {
    const chosen = await getSelectedProject(orgId);
    if (chosen) redirect(`/orgs/${orgId}/dashboard?projectId=${encodeURIComponent(chosen.id)}`);
  }
  const { facilityId: selectedFacilityId, contractId: selectedContractId, entityId: selectedEntityId, country: selectedCountry, supplier: selectedSupplier, from: selectedFrom, to: selectedTo, scope: selectedScope, projectId: selectedProjectId, sv: selectedSv, categoryId: selectedCategoryId } = rawParams;
  const sliceFilter = parseSliceFilter({ supplier: selectedSupplier, from: selectedFrom, to: selectedTo, scope: selectedScope, projectId: selectedProjectId, sv: selectedSv, categoryId: selectedCategoryId, facilityId: selectedFacilityId });
  let session: Awaited<ReturnType<typeof requireOrgMember>>["session"];
  let membership: Awaited<ReturnType<typeof requireOrgMember>>["membership"];
  let dashAuthErr: AuthError | null = null;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    session = result.session;
    membership = result.membership;
  } catch (err) {
    if (err instanceof AuthError) { dashAuthErr = err; }
    else { return <div className="p-8"><p className="text-sm text-red-600">Failed to load dashboard. The database may be updating — try refreshing in a moment.</p></div>; }
  }
  if (dashAuthErr) {
    if (dashAuthErr.status === 401) redirect("/sign-in");
    redirect("/");
  }
  const role = membership!.role;

  // Every query below falls back to an empty value so one failure cannot blank
  // the whole dashboard. Counting the failures is what stops a failed query
  // from being indistinguishable from a genuine zero: without it the page
  // renders "0 records" with full confidence when the truth is that it does not
  // know. Request-local, so concurrent requests cannot see each other's count.
  let failedFigureCount = 0;
  const onLoadFailure =
    <T,>(fallback: () => T) =>
    (): T => {
      failedFigureCount++;
      return fallback();
    };

  // Field workers and suppliers have no visibility into org emissions data
  // (the org layout sends them away first; kept as a second guard).
  if (role === "field_worker") redirect("/app");
  if (role === "supplier") redirect("/supplier-portal");

  // Everything here depends only on the organisation, so it is fetched in one
  // stage. Counts and the latest run's figures come from one statement each
  // (lib/dashboard/page-data.ts): Prisma has one connection per instance, so
  // every separate query was another database round trip.
  const [onboardingProgress, org, reportingPeriods, activeContracts, selectedContract, contractFacilityIds, counts, latestRun] =
    await Promise.all([
      role === "admin"
        ? prisma.onboardingProgress.findUnique({
            where: { organizationId: orgId },
            select: { isComplete: true, completedSteps: true },
          }).catch(onLoadFailure(() => null))
        : Promise.resolve(null),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true, industry: true, hqCountry: true, reportingCurrency: true, plan: true, isPilot: true },
      }).catch(onLoadFailure(() => null)),
      prisma.reportingPeriod.findMany({
        where: { organizationId: orgId },
        select: { id: true, label: true, status: true, endDate: true },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      }).catch(onLoadFailure(() => [] as { id: string; label: string; status: string; endDate: Date }[])),
      // Contract filter support
      prisma.contract.findMany({
        where: { organizationId: orgId, status: "active" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }).catch(onLoadFailure(() => [] as { id: string; name: string }[])),
      selectedContractId
        ? prisma.contract.findFirst({
            where: { id: selectedContractId, organizationId: orgId },
            select: { name: true },
          }).catch(onLoadFailure(() => null))
        : Promise.resolve(null),
      // Facilities linked to the selected contract via sites and activity records
      selectedContractId
        ? prisma.$queryRaw<Array<{ facility_id: string }>>`
            SELECT DISTINCT ar.facility_id
            FROM activity_records ar
            INNER JOIN sites s ON s.id = ar.site_id
            INNER JOIN projects p ON p.id = s.project_id
            WHERE p.contract_id = ${selectedContractId}
              AND ar.organization_id = ${orgId}
              AND ar.facility_id IS NOT NULL
          `.then((rows) => rows.map((r) => r.facility_id)).catch(() => [] as string[])
        : Promise.resolve(null),
      loadDashboardCounts(orgId).catch(onLoadFailure(() => null)),
      // Latest succeeded calculation run (used for data quality metrics)
      loadLatestRunStats(orgId).catch(onLoadFailure(() => null)),
    ]);

  // Send admins of a brand-new organisation (no activity data yet) to the
  // onboarding wizard. Once records exist the dashboard has something to
  // show, so an unticked checklist step never locks an admin out of it.
  const hasActivity = counts ? counts.records > 0 : true;
  if (role === "admin" && !onboardingProgress?.isComplete && !hasActivity) {
    redirect(`/orgs/${orgId}/onboarding`);
  }

  if (!org) {
    return <div className="p-8"><p className="text-sm text-red-600">Organisation not found or database is temporarily unavailable — please refresh.</p></div>;
  }
  const organization = org;
  // Numbers and dates follow the organisation's country, not the UK.
  const L = orgFormat(org).locale;
  const liveDashboardEnabled = org.isPilot || hasFeature(org.plan ?? "trial", "liveDashboard");

  // One organisation is one reporting group: entity and country are filters
  // inside it, applied as the set of facilities they cover (like a contract).
  const [groupEntities, groupFacilities] = await Promise.all([
    prisma.legalEntity.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, parentId: true },
      orderBy: { name: "asc" },
    }).catch(onLoadFailure(() => [] as { id: string; name: string; parentId: string | null }[])),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      select: { id: true, country: true, legalEntityId: true },
    }).catch(onLoadFailure(() => [] as { id: string; country: string | null; legalEntityId: string | null }[])),
  ]);
  const groupCountries = facilityCountries(groupFacilities);
  const groupFacilityIds = facilityScope(groupFacilities, groupEntities, { entityId: selectedEntityId, country: selectedCountry });
  const scopeFacilityIds =
    contractFacilityIds === null
      ? groupFacilityIds
      : groupFacilityIds === null
        ? contractFacilityIds
        : contractFacilityIds.filter((id) => groupFacilityIds.includes(id));
  const scoped = scopeFacilityIds !== null || sliceFilter !== null;
  const dashboardHref = (p: { contractId?: string; entityId?: string; country?: string }) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ supplier: selectedSupplier, from: selectedFrom, to: selectedTo, scope: selectedScope, projectId: selectedProjectId, sv: selectedSv, categoryId: selectedCategoryId })) if (v) q.set(k, v);
    if (p.contractId) q.set("contractId", p.contractId);
    if (p.entityId) q.set("entityId", p.entityId);
    if (p.country) q.set("country", p.country);
    const qs = q.toString();
    return `/orgs/${orgId}/dashboard${qs ? `?${qs}` : ""}`;
  };

  const dashboardFilters = activeFilters("dashboard", { facilityId: selectedFacilityId, contractId: selectedContractId, entityId: selectedEntityId, country: selectedCountry, supplier: selectedSupplier, from: selectedFrom, to: selectedTo, scope: selectedScope, projectId: selectedProjectId, sv: selectedSv, categoryId: selectedCategoryId });
  const currentPeriod = reportingPeriods[0] ?? null;
  const priorPeriod = reportingPeriods[1] ?? null;

  // Records the run processed but that contributed no emissions: a unit the
  // factor could not consume, no matching factor, or a zero input amount. Their
  // CO2e is genuinely 0, so the headline total is silently short by however many
  // of these there are unless the count is on the page.
  const zeroCo2eCalcCount = latestRun?.zeroCo2eCount ?? 0;
  const noFactorCount = latestRun?.noFactorCount ?? 0;
  const latestRunCalcCount = latestRun?.calculationCount ?? 0;

  // Reports are built from a PublishedSnapshot, but every figure on this page
  // is the live aggregate. A recalculation that has not been published makes
  // the two diverge, so the page has to say so rather than let the customer
  // assume their PDF will match.
  const latestSnapshot = currentPeriod
    ? await prisma.publishedSnapshot.findFirst({
        where: { organizationId: orgId, reportingPeriodId: currentPeriod.id },
        orderBy: { version: "desc" },
        select: { id: true, version: true, publishedAt: true },
      }).catch(onLoadFailure(() => null))
    : null;

  const snapshotRollupWhere = {
    organizationId: orgId,
    ...SCOPE_ROLLUP_DIMENSIONS,
    facilityId: null,
  };

  const [liveTotalAgg, snapshotTotalAgg] = currentPeriod
    ? await Promise.all([
        prisma.dashboardAggregate.aggregate({
          where: {
            ...snapshotRollupWhere,
            reportingPeriodId: currentPeriod.id,
            snapshotId: null,
          },
          _sum: { totalCo2e: true },
        }).catch(onLoadFailure(() => ({ _sum: { totalCo2e: null } }))),
        latestSnapshot
          ? prisma.dashboardAggregate.aggregate({
              where: {
                ...snapshotRollupWhere,
                reportingPeriodId: currentPeriod.id,
                snapshotId: latestSnapshot.id,
              },
              _sum: { totalCo2e: true },
            }).catch(onLoadFailure(() => ({ _sum: { totalCo2e: null } })))
          : Promise.resolve({ _sum: { totalCo2e: null } }),
      ])
    : [{ _sum: { totalCo2e: null } }, { _sum: { totalCo2e: null } }];

  const latestPeriodRun = currentPeriod && latestSnapshot
    ? await prisma.calculationRun.findFirst({
        where: { organizationId: orgId, reportingPeriodId: currentPeriod.id, status: "succeeded" },
        orderBy: { createdAt: "desc" },
        select: { id: true, finishedAt: true },
      }).catch(onLoadFailure(() => null))
    : null;

  const liveTotalCo2e = Number(liveTotalAgg._sum.totalCo2e ?? 0);
  const snapshotTotalCo2e = Number(snapshotTotalAgg._sum.totalCo2e ?? 0);
  // 0.5 kg absorbs Decimal rounding without masking a real restatement.
  const snapshotDiverges =
    latestSnapshot != null && Math.abs(liveTotalCo2e - snapshotTotalCo2e) > 0.5;

  // Split into two parallel batches to stay within TypeScript's Promise.all tuple inference limit
  const [batchA, batchB, liveTrendAggregates, liveFacilityAggregates, ocrDiscrepancySubmissions, livePriorScopeAggregates, environmentalAggregatesRaw, approvedCountsRows, pilotRecentGeneration, industryData] = await Promise.all([
    Promise.all([
      currentPeriod
        ? prisma.dashboardAggregate.groupBy({
            by: ["scope"],
            where: {
              organizationId: orgId,
              reportingPeriodId: currentPeriod.id,
              snapshotId: null,
              // DashboardAggregate holds one row per breakdown dimension
              // (scope rollup, by category, by facility, by business unit) for
              // the same underlying calculations. Every read must pin the
              // dimensions it wants or the same CO2e is summed 2-4 times.
              ...SCOPE_ROLLUP_DIMENSIONS,
              // Contract scope is expressed through facility rows; org-wide
              // totals come from the facility-agnostic rollup rows.
              facilityId:
                scopeFacilityIds !== null ? { in: scopeFacilityIds } : null,
            },
            _sum: { totalCo2e: true, recordCount: true },
            orderBy: { scope: "asc" },
          })
        : Promise.resolve([] as { scope: number; _sum: { totalCo2e: string | null; recordCount: number | null } }[]),
      prisma.reviewTask.findMany({
        where: {
          organizationId: orgId,
          assigneeUserId: session!.user.id,
          status: "open",
        },
        include: {
          assignee: { select: { name: true, email: true } },
          createdBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }).catch(onLoadFailure(() => [])),
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
      }).catch(onLoadFailure(() => [])),
      prisma.activityRecord.findMany({
        where: { organizationId: orgId, reviewStatus: { in: ["in_review", "rejected"] } },
        include: {
          emissionCategory: { select: { scope: true, name: true } },
          reportingPeriod: { select: { label: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }).catch(onLoadFailure(() => [])),
      prisma.report.findMany({
        where: { organizationId: orgId, status: "failed" },
        select: {
          id: true,
          type: true,
          status: true,
          reportingPeriod: { select: { label: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 4,
      }).catch(onLoadFailure(() => [])),
    ] as const),
    Promise.all([
      prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ["admin", "editor", "reviewer"] } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }).catch(onLoadFailure(() => [])),
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 6,
      }).catch(onLoadFailure(() => [])),
      prisma.methodologyVersion.findMany({
        select: { id: true, name: true, gwpVersion: true },
        orderBy: { createdAt: "desc" },
      }).catch(onLoadFailure(() => [])),
      prisma.factorLibrary.findMany({
        select: { id: true, name: true, version: true },
        orderBy: { publishedAt: "desc" },
      }).catch(onLoadFailure(() => [])),
      prisma.calculationRun.findMany({
        where: { organizationId: orgId },
        include: {
          reportingPeriod: { select: { label: true } },
          factorLibrary: { select: { name: true, version: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }).catch(onLoadFailure(() => [])),
      prisma.fieldSubmission.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }).catch(onLoadFailure(() => [])),
      prisma.fieldSubmission.groupBy({
        by: ["documentType"],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { documentType: "asc" },
      }).catch(onLoadFailure(() => [])),
      prisma.reductionInitiative.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        _sum: { costAmount: true, expectedImpactCo2e: true },
        orderBy: { status: "asc" },
      }).catch(onLoadFailure(() => [])),
      prisma.reductionTarget.aggregate({
        where: { organizationId: orgId },
        _sum: { reductionAmount: true },
      }).catch(onLoadFailure(() => ({ _sum: { reductionAmount: null } }))),
      currentPeriod
        ? prisma.dashboardAggregate.findMany({
            where: {
              organizationId: orgId,
              reportingPeriodId: currentPeriod.id,
              snapshotId: null,
              // A Scope 2 category has one row per reporting method, so without
              // this filter it occupies two of the five slots and its CO2e is
              // presented twice.
              ...CATEGORY_BY_FACILITY_DIMENSIONS,
              // With a contract selected, read the category-and-facility cross
              // rows restricted to that contract's facilities, so the breakdown
              // is scoped the same way the totals above are. Org-wide, read the
              // facility-agnostic category rows.
              facilityId:
                scopeFacilityIds !== null ? { in: scopeFacilityIds } : null,
            },
            include: {
              emissionCategory: { select: { name: true, scope: true } },
            },
            orderBy: { totalCo2e: "desc" },
            take: 5,
          }).catch(onLoadFailure(() => []))
        : Promise.resolve([] as { id: string; scope: number; totalCo2e: string; recordCount: number; emissionCategory: { name: string; scope: number } | null }[]),
      prisma.report.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }).catch(onLoadFailure(() => [])),
      prisma.socialValueRecord.aggregate({
        where: { organizationId: orgId },
        _sum: { valuePounds: true },
        _count: { _all: true },
      }).catch(onLoadFailure(() => ({ _sum: { valuePounds: null }, _count: { _all: 0 } }))),
    ] as const),
    // Period trend: live scope-level aggregates across all reporting periods.
    prisma.dashboardAggregate.findMany({
      where: {
        organizationId: orgId,
        snapshotId: null,
        emissionCategoryId: null,
        facilityId: null,
        businessUnitId: null,
        ...PRIMARY_SCOPE2_METHOD,
      },
      select: {
        scope: true,
        totalCo2e: true,
        reportingPeriod: { select: { id: true, label: true, startDate: true } },
      },
    }).catch(onLoadFailure(() => [])),
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
            ...PRIMARY_SCOPE2_METHOD,
          },
          include: {
            facility: { select: { id: true, name: true } },
          },
          orderBy: { totalCo2e: "desc" },
        }).catch(onLoadFailure(() => []))
      : Promise.resolve(
          [] as {
            id: string;
            facilityId: string | null;
            totalCo2e: string | { toNumber: () => number };
            recordCount: number;
            facility: { id: string; name: string } | null;
          }[],
        ),
    // Data quality: OCR against what the reviewer approved
      prisma.fieldSubmission.findMany({
        where: {
          organizationId: orgId,
          status: "approved",
          ocrExtractedData: { not: Prisma.JsonNull },
          formData: { not: Prisma.JsonNull },
        },
        select: { ocrExtractedData: true, formData: true },
        take: 200,
        orderBy: { createdAt: "desc" },
      }).catch(onLoadFailure(() => [])),
    // Prior period scope-level aggregates for year-on-year comparison
    priorPeriod
      ? prisma.dashboardAggregate.groupBy({
          by: ["scope"],
          where: {
            organizationId: orgId,
            reportingPeriodId: priorPeriod.id,
            snapshotId: null,
            // Must mirror the current-period query exactly, or the
            // period-on-period change compares differently-scoped totals.
            ...SCOPE_ROLLUP_DIMENSIONS,
            facilityId:
              scopeFacilityIds !== null ? { in: scopeFacilityIds } : null,
          },
          _sum: { totalCo2e: true, recordCount: true },
          orderBy: { scope: "asc" },
        }).catch(onLoadFailure(() => []))
      : Promise.resolve([] as { scope: number; _sum: { totalCo2e: string | null; recordCount: number | null } }[]),
    // Environmental (water/waste) metric aggregates — ESRS E3/E5
    currentPeriod
      ? prisma.environmentalMetricAggregate.groupBy({
          by: ["metricType"],
          where: { organizationId: orgId, reportingPeriodId: currentPeriod.id, snapshotId: null },
          _sum: { totalValue: true },
        }).catch(onLoadFailure(() => []))
      : Promise.resolve([] as { metricType: string; _sum: { totalValue: string | null } }[]),
    // Approved record counts per period — progress bars across periods
    prisma.activityRecord.groupBy({
      by: ["reportingPeriodId"],
      where: { organizationId: orgId, reviewStatus: "approved" },
      _count: { _all: true },
    }).catch(onLoadFailure(() => [])),
    // Pilot kit — most-recent generation audit log entry
    prisma.auditLog.findFirst({
      where: { organizationId: orgId, action: "pilot.kit_generated" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, metadata: true },
    }).catch(onLoadFailure(() => null)),
    // Industry-specific data
    (async () => {
      const industry = organization.industry ?? null;
      if (industry === "construction") {
        const [agg, byCategory] = await Promise.all([
          prisma.embodiedCarbonRecord.aggregate({
            where: { organizationId: orgId },
            _sum: { totalKgCo2e: true },
            _count: { _all: true },
          }).catch(onLoadFailure(() => ({ _sum: { totalKgCo2e: null }, _count: { _all: 0 } }))),
          prisma.embodiedCarbonRecord.groupBy({
            by: ["materialId"],
            where: { organizationId: orgId },
            _sum: { totalKgCo2e: true },
            _count: { _all: true },
            orderBy: { _sum: { totalKgCo2e: "desc" } },
            take: 5,
          }).catch(onLoadFailure(() => [] as { materialId: string; _sum: { totalKgCo2e: string | null }; _count: { _all: number } }[])),
        ]);
        return {
          type: "construction" as const,
          totalKgCo2e: Number(agg._sum.totalKgCo2e ?? 0),
          recordCount: agg._count._all,
          topCategories: byCategory.length,
        };
      }
      if (industry === "logistics") {
        const transportAgg = await prisma.dashboardAggregate.aggregate({
          where: {
            organizationId: orgId,
            scope: 3,
            snapshotId: null,
            ...(currentPeriod ? { reportingPeriodId: currentPeriod.id } : {}),
            ...SCOPE_ROLLUP_DIMENSIONS,
            facilityId: null,
          },
          _sum: { totalCo2e: true, recordCount: true },
        }).catch(onLoadFailure(() => ({ _sum: { totalCo2e: null, recordCount: null } })));
        return {
          type: "logistics" as const,
          transportKgCo2e: Number(transportAgg._sum.totalCo2e ?? 0),
          transportRecords: transportAgg._sum.recordCount ?? 0,
        };
      }
      if (industry === "facilities_management") {
        const electricityCategory = await prisma.emissionCategory.findFirst({
          where: { code: { in: ["s2-electricity-lb", "s2-electricity-mb"] } },
          select: { id: true },
        }).catch(onLoadFailure(() => null));
        const energyAgg = electricityCategory
          ? await prisma.dashboardAggregate.aggregate({
              where: {
                organizationId: orgId,
                emissionCategoryId: electricityCategory.id,
                snapshotId: null,
                ...(currentPeriod ? { reportingPeriodId: currentPeriod.id } : {}),
                facilityId: null,
                businessUnitId: null,
                ...PRIMARY_SCOPE2_METHOD,
              },
              _sum: { totalCo2e: true, recordCount: true },
            }).catch(onLoadFailure(() => ({ _sum: { totalCo2e: null, recordCount: null } })))
          : { _sum: { totalCo2e: null, recordCount: null } };
        return {
          type: "facilities_management" as const,
          energyKgCo2e: Number(energyAgg._sum.totalCo2e ?? 0),
          energyRecords: energyAgg._sum.recordCount ?? 0,
        };
      }
      if (industry === "public_procurement") {
        const latestCrp = await prisma.report.findFirst({
          where: { organizationId: orgId, type: "ppn_006_crp" },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, createdAt: true },
        }).catch(onLoadFailure(() => null));
        return {
          type: "public_procurement" as const,
          crpStatus: latestCrp?.status ?? null,
          crpDate: latestCrp?.createdAt?.toLocaleDateString(L, { day: "numeric", month: "short", year: "numeric" }) ?? null,
        };
      }
      return null;
    })(),
  ]);

  const [
    liveScopeAggregates,
    myReviewTasks,
    reviewImports,
    reviewRecords,
    reviewReports,
  ] = batchA;

  const [
    reviewAssignees,
    recentAuditLogs,
    methodologies,
    factorLibraries,
    calculationRuns,
    submissionStatusRows,
    submissionDocumentRows,
    initiativeStatusRows,
    targetReductionStats,
    liveTopCategoryAggregates,
    reportStatusRows,
    socialValueStats,
  ] = batchB;

  // The slice table answers the supplier, month, scope, project and social value
  // filters and feeds the flow diagram; the rest of the page keeps its
  // aggregate reads. With no filter set the aggregates still own the headline.
  const sliceView = currentPeriod
    ? await loadSliceView(orgId, currentPeriod.id, sliceFilter ?? {}, scopeFacilityIds).catch(onLoadFailure(() => null))
    : null;
  const periodCategoryTotals =
    currentPeriod && priorPeriod && !scoped
      ? await loadPeriodCategoryTotals(orgId, currentPeriod.id, priorPeriod.id).catch(onLoadFailure(() => null))
      : null;
  const waterfallAi = periodCategoryTotals ? await aiAssistEnabled(orgId).catch(() => false) : false;
  const changeSteps =
    periodCategoryTotals && (periodCategoryTotals.previous.length > 0 || periodCategoryTotals.current.length > 0)
      ? buildWaterfall(periodCategoryTotals.previous, periodCategoryTotals.current, { previous: priorPeriod!.label, current: currentPeriod!.label })
      : [];
  const projectOptions = (
    await prisma.project
      .findMany({ where: { organizationId: orgId }, select: { id: true, name: true, contract: { select: { name: true } } }, orderBy: { name: "asc" }, take: 200 })
      .catch(onLoadFailure(() => [] as { id: string; name: string; contract: { name: string } }[]))
  ).map((p) => ({ id: p.id, label: `${p.name} (${p.contract.name})` }));
  const socialValueRefs = sliceFilter?.socialValue ? await resolveSliceRefs(orgId, { socialValue: true }).catch(onLoadFailure(() => ({} as SliceRefs))) : null;
  const socialValueSummary = socialValueRefs?.contractIds
    ? await socialValueBeside(orgId, socialValueRefs.contractIds).catch(onLoadFailure(() => null))
    : null;
  const socialValueNote = socialValueSummary
    ? {
        contracts: socialValueSummary.contracts,
        commitments: socialValueSummary.commitments,
        gbpValue: socialValueSummary.gbpValue > 0 ? new Intl.NumberFormat(L, { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(socialValueSummary.gbpValue) : "",
        otherCurrency: socialValueSummary.otherCurrency,
      }
    : null;
  const sliced = sliceFilter ? sliceView : null;
  // Under a supplier, month, scope, project, social value, category or site filter the trend and the
  // year-on-year panel follow it too (same slices, every period), so the change shown is like for like.
  const [slicedTrend, slicedPrior] = sliceFilter
    ? await Promise.all([
        loadSliceTrend(orgId, sliceFilter, scopeFacilityIds).catch(onLoadFailure(() => null)),
        priorPeriod ? loadSliceScopes(orgId, priorPeriod.id, sliceFilter, scopeFacilityIds).catch(onLoadFailure(() => null)) : Promise.resolve(null),
      ])
    : [null, null];
  const trendAggregates = slicedTrend ?? liveTrendAggregates;
  const priorScopeAggregates = slicedPrior ?? livePriorScopeAggregates;
  const crossChips = [
    selectedScope && ["1", "2", "3"].includes(selectedScope) ? { key: "scope", label: `Scope ${selectedScope}` } : null,
    selectedCategoryId ? { key: "categoryId", label: sliceView?.names.categories[selectedCategoryId] ?? "Category" } : null,
    selectedFacilityId ? { key: "facilityId", label: sliceView?.names.facilities[selectedFacilityId] ?? "Site" } : null,
  ].filter((c): c is { key: string; label: string } => c !== null);
  const recordsQuery = new URLSearchParams();
  if (currentPeriod) recordsQuery.set("periodId", currentPeriod.id);
  for (const [k, v] of Object.entries({ categoryId: selectedCategoryId, facilityId: selectedFacilityId, contractId: selectedContractId, supplier: selectedSupplier })) if (v) recordsQuery.set(k, v);
  const recordsHref = selectedCategoryId || selectedFacilityId || selectedContractId || selectedSupplier ? `/orgs/${orgId}/records?${recordsQuery.toString()}` : null;
  const scopeAggregates = sliced?.scopeAggregates ?? liveScopeAggregates;
  const topCategoryAggregates = sliced?.topCategoryAggregates ?? liveTopCategoryAggregates;
  const facilityAggregates = sliced?.facilityAggregates ?? liveFacilityAggregates;

  const recordCount = counts?.records ?? 0;
  const approvedRecordCount = counts?.approvedRecords ?? 0;
  const importCount = counts?.imports ?? 0;
  const failedImportCount = counts?.failedImports ?? 0;
  const failedCalculationCount = counts?.failedCalculations ?? 0;
  const openReviewTaskCount = counts?.openReviewTasks ?? 0;
  const targetCount = counts?.targets ?? 0;
  const initiativeCount = counts?.initiatives ?? 0;
  const evidenceFileCount = counts?.evidenceFiles ?? 0;
  const missingEvidenceCount = counts?.approvedWithoutEvidence ?? 0;
  const pendingAttentionCount = counts?.pendingAttention ?? 0;
  const staleRecordCount = latestRun?.recordsAddedSince ?? 0;
  const OPEN_SUBMISSION_STATUSES = new Set(["pending", "submitted", "under_review", "needs_info"]);
  const pendingSubmissionCount = submissionStatusRows
    .filter((row) => OPEN_SUBMISSION_STATUSES.has(row.status))
    .reduce((total, row) => total + row._count._all, 0);
  const reportCountByStatus = (status?: string) =>
    reportStatusRows
      .filter((row) => status === undefined || row.status === status)
      .reduce((total, row) => total + row._count._all, 0);
  const reportCount = reportCountByStatus();
  const readyReportCount = reportCountByStatus("ready");
  const failedReportCount = reportCountByStatus("failed");

  // Published figures calculated with a factor set that has since been
  // corrected (DEFRA 2025.1 was replaced by 2025.2). Every tenant sees this
  // for its own snapshots until it recalculates and republishes.
  const publishedLibraries = await loadPublishedLibraries(orgId).catch(onLoadFailure(() => []));
  const seenPeriods = new Set<string>();
  const staleSnapshots = publishedLibraries.flatMap((snap) => {
    if (seenPeriods.has(snap.reportingPeriodId)) return [];
    seenPeriods.add(snap.reportingPeriodId);
    const used = snap.calculationRun.factorLibrary;
    const replacement = used ? supersedingLibrary(used, factorLibraries) : null;
    return replacement ? [{ period: snap.reportingPeriod.label, version: snap.version, used, replacement }] : [];
  });

  // Published figures calculated under an older methodology version
  // (lib/calculation/methodology.ts). methodologies is newest first.
  const outdatedSnapshots = outdatedMethodology(
    publishedLibraries.map((snap) => ({
      reportingPeriodId: snap.reportingPeriodId,
      version: snap.version,
      periodLabel: snap.reportingPeriod.label,
      methodology: snap.calculationRun.methodologyVersion?.name ?? null,
    })),
    methodologies[0]?.name ?? null,
  );


  // Pilot kit — presign R2 URLs for the generation fetched in the main batch
  type PilotDoc = { name: string; audience: string; storageKey: string; downloadUrl: string | null; error?: string };
  type PilotKitData = { code: string; data: { generatedAt: string; documents: PilotDoc[]; context: Record<string, unknown> | null } };
  let pilotKitData: PilotKitData | null = null;
  let pilotKitDocuments: PilotDoc[] = [];

  try {
    if (pilotRecentGeneration) {
      const metadata = typeof pilotRecentGeneration.metadata === "object" && pilotRecentGeneration.metadata !== null
        ? pilotRecentGeneration.metadata
        : {};
      const meta = metadata as Record<string, unknown>;
      const timestamp = (meta.timestamp as string | undefined) || pilotRecentGeneration.createdAt.toISOString().split("T")[0];

      const { presignDownload } = await import("@/lib/storage");

      const documents = [
        { name: "Executive Summary", audience: "Executive Stakeholders", key: `org/${orgId}/pilot-kit/01-executive-summary-${timestamp}.pdf` },
        { name: "Sustainability Manager Guide", audience: "Sustainability Lead", key: `org/${orgId}/pilot-kit/02-sustainability-manager-${timestamp}.pdf` },
        { name: "Finance Lead Guide", audience: "Finance Lead", key: `org/${orgId}/pilot-kit/03-finance-lead-${timestamp}.pdf` },
        { name: "Field Worker Guide", audience: "Field Workers", key: `org/${orgId}/pilot-kit/04-field-worker-${timestamp}.pdf` },
        { name: "Technical Integration Guide", audience: "IT Administrator", key: `org/${orgId}/pilot-kit/05-technical-integration-${timestamp}.pdf` },
        { name: "Compliance Guide", audience: "Compliance & Audit", key: `org/${orgId}/pilot-kit/06-compliance-guide-${timestamp}.pdf` },
      ];

      const documentsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          try {
            const downloadUrl = await presignDownload(doc.key);
            return { name: doc.name, audience: doc.audience, storageKey: doc.key, downloadUrl };
          } catch (err) {
            console.error(`Failed to presign download for ${doc.key}:`, err);
            return { name: doc.name, audience: doc.audience, storageKey: doc.key, downloadUrl: null, error: "Failed to generate download link" };
          }
        })
      );

      pilotKitData = {
        code: "OK",
        data: {
          generatedAt: pilotRecentGeneration.createdAt.toISOString(),
          documents: documentsWithUrls,
          context: (meta.context as Record<string, unknown> | undefined) ?? null,
        },
      };
      pilotKitDocuments = documentsWithUrls;
    }
  } catch (err) {
    console.error("Failed to fetch pilot kit documents:", err);
  }

  // Water & waste (ESRS E3/E5) — derived from the pre-fetched batch result
  const environmentalTotals = Object.fromEntries(
    environmentalAggregatesRaw.map((row) => [row.metricType, Number(row._sum.totalValue ?? 0)]),
  ) as Record<string, number>;
  const hasEnvironmentalData = environmentalAggregatesRaw.length > 0;
  const wasteDiversionPct = environmentalTotals.waste_generated
    ? Math.round(((environmentalTotals.waste_diverted ?? 0) / environmentalTotals.waste_generated) * 100)
    : null;

  const approvedCountByPeriod: Record<string, number> = Object.fromEntries(
    approvedCountsRows.map((row) => [row.reportingPeriodId, row._count._all]),
  );

  const totalCalcCo2e = latestRun?.totalCo2e ?? 0;
  const approvedCalcCo2e = latestRun?.approvedCo2e ?? 0;
  const dataConfidencePct =
    totalCalcCo2e > 0 ? Math.round((approvedCalcCo2e / totalCalcCo2e) * 100) : null;

  // Signal 2: fallback factor exposure percentage
  const fallbackCo2e = latestRun?.fallbackCo2e ?? 0;
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
  // The per-facility aggregate rows are written one per scope, so a facility
  // with Scope 1 and Scope 2 records comes back more than once: sum them.
  const facilityById = new Map<string, { id: string; name: string; totalCo2e: number; recordCount: number }>();
  for (const agg of facilityAggregates) {
    const id = agg.facilityId ?? "";
    const row = facilityById.get(id) ?? { id, name: agg.facility?.name ?? "Unknown facility", totalCo2e: 0, recordCount: 0 };
    row.totalCo2e += Number(agg.totalCo2e);
    row.recordCount += agg.recordCount;
    facilityById.set(id, row);
  }
  const facilityRows = [...facilityById.values()].sort((a, b) => b.totalCo2e - a.totalCo2e);
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

  const priorScopeRows = [1, 2, 3].map((scope) => {
    const aggregate = priorScopeAggregates.find((row) => row.scope === scope);
    return {
      scope,
      total: aggregate?._sum.totalCo2e ?? 0,
      records: aggregate?._sum.recordCount ?? 0,
    };
  });

  const hasAggregates = scopeRows.some((row) => Number(row.total) > 0 || Number(row.records) > 0);

  // Internal carbon price (Settings > Carbon price) applied to this page's
  // location-based scope totals. Informational: nothing is charged here.
  const carbonPrice = appraisalPrice(await loadCarbonPrices(orgId).catch(onLoadFailure(() => [])), new Date());
  const carbonPriceCost = carbonPrice && hasAggregates
    ? coveredCost(scopeRows.map((r) => ({ scope: r.scope, tco2e: Number(r.total) / 1000 })), carbonPrice)
    : null;
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
    (!scoped || slicedTrend !== null) && previousTrendTotal && previousTrendTotal > 0
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
      }).catch(onLoadFailure(() => null)),
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
      createdAt: task.createdAt.toLocaleDateString(L, {
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
    reviewAssigneeOptions.find((assignee) => assignee.id === session!.user.id)?.id ??
    reviewAssigneeOptions[0]?.id ??
    session!.user.id;

  // Each block of the dashboard is a widget: the layout (per person, per
  // organisation, per role) only orders and sizes them, the figures inside are
  // built here, under this viewer's role.
  const widgetNodes: Record<string, ReactNode> = {};
  widgetNodes["headline"] = (
    <>
      {/* ── Carbon footprint hero ─────────────────────────────────────────── */}
      <section
        aria-label="Carbon footprint summary"
        className="mt-2 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <div className="rounded-[14px] border border-[#c2410c] bg-[#c2410c] p-[21px] text-white md:col-span-2 xl:col-span-1">
          <div className="flex items-center gap-2">
            <Leaf aria-hidden="true" className="h-4 w-4 text-white" />
            <p className="text-xs font-normal uppercase tracking-wide text-white">
              Total footprint
            </p>
          </div>
          <p className="mt-3 text-4xl font-normal tracking-[-0.4px]">
            {currentFootprint > 0 ? formatKgCo2e(L, currentFootprint) : "—"}
          </p>
          <p className="mt-1 text-xs text-white tracking-[-0.36px]">
            {currentFootprint > 0
              ? `Scopes 1–3 · ${currentPeriod?.label ?? "current period"}`
              : sliceFilter
                ? "No calculated emissions match these filters"
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
            periodDeltaPct !== null
              ? sliceFilter
                ? "vs previous reporting period, same filters"
                : "vs previous reporting period"
              : scoped
                ? "Clear the filters to compare"
                : "Calculate a second period to compare"
          }
          tone={periodDeltaPct === null ? "neutral" : periodDeltaPct <= 0 ? "good" : "bad"}
        />

        <HeroStat
          icon={Gauge}
          label="Scope coverage"
          value={`${scopesWithActivity}/3`}
          detail={`${currentCalculatedRecords.toLocaleString(L)} calculated records`}
        />

        {targetCount > 0 ? (
          <HeroStat
            icon={Target}
            label="Target ambition"
            value={formatKgCo2e(L, targetReductionTotal)}
            detail={`${targetCount.toLocaleString(L)} active reduction target${targetCount !== 1 ? "s" : ""}`}
            href={`/orgs/${orgId}/targets`}
          />
        ) : (
          <Link
            href={`/orgs/${orgId}/targets`}
            className="group flex flex-col justify-between rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-[21px] transition-colors hover:bg-[#FFEDD5]"
          >
            <div className="flex items-center gap-2">
              <Target aria-hidden="true" className="h-4 w-4 text-[#111827]" />
              <p className="text-xs font-normal uppercase tracking-wide text-[#111827]">
                Reduction target
              </p>
            </div>
            <div className="mt-3">
              <p className="text-base font-normal text-[#111827] tracking-[-0.42px]">
                Set your first target
              </p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-[#374151] tracking-[-0.36px]">
                Define a baseline and goal
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              </p>
            </div>
          </Link>
        )}
      </section>

    </>
  );
  widgetNodes["live"] = (
    <>
      {/* ── Real-time dashboard stream (plan feature; without it the stream
          answers 402 and the panel would sit on "Connecting" retrying) ── */}
      {liveDashboardEnabled && (
      <section aria-label="Live dashboard" className="mt-8">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
          Live updates
        </p>
        <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-6">
          <LiveDashboard
            orgId={orgId}
            locale={L}
            fallbackComponent={
              <div className="text-sm text-[#6B7280]">
                <p>Real-time emissions updates will appear here as calculations complete.</p>
              </div>
            }
          />
        </div>
      </section>
      )}

    </>
  );
  widgetNodes["industry"] = (
    <>
      {industryData && (
        <section aria-label="Industry insights" className="mt-8">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
            {industryData.type === "construction" && "Embodied carbon"}
            {industryData.type === "logistics" && "Logistics insights"}
            {industryData.type === "facilities_management" && "Building energy"}
            {industryData.type === "public_procurement" && "Procurement compliance"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {industryData.type === "construction" && (
              <>
                <MetricCard
                  icon={Layers}
                  label="Embodied carbon total"
                  value={industryData.totalKgCo2e >= 1000
                    ? `${(industryData.totalKgCo2e / 1000).toFixed(2)} tCO₂e`
                    : `${industryData.totalKgCo2e.toFixed(1)} kgCO2e`}
                  detail={`${industryData.recordCount} material record${industryData.recordCount !== 1 ? "s" : ""}`}
                  href={`/orgs/${orgId}/embodied-carbon`}
                />
                <MetricCard
                  icon={BarChart3}
                  label="Material categories"
                  value={String(industryData.topCategories)}
                  detail="Distinct material types recorded"
                  href={`/orgs/${orgId}/embodied-carbon`}
                />
              </>
            )}
            {industryData.type === "logistics" && (
              <>
                <MetricCard
                  icon={Route}
                  label="Transport emissions (Scope 3)"
                  value={industryData.transportKgCo2e >= 1000
                    ? `${(industryData.transportKgCo2e / 1000).toFixed(2)} tCO₂e`
                    : `${industryData.transportKgCo2e.toFixed(1)} kgCO2e`}
                  detail={`${industryData.transportRecords} Scope 3 records`}
                />
                <Link
                  href={`/orgs/${orgId}/records?scope=3`}
                  className="flex flex-col justify-between rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-[21px] transition-colors hover:bg-[#FFEDD5]"
                >
                  <div className="flex items-center gap-2">
                    <Scale aria-hidden="true" className="h-4 w-4 text-[#111827]" />
                    <p className="text-xs font-normal uppercase tracking-wide text-[#111827]">tCO₂e/tonne-km</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-normal text-[#111827] tracking-[-0.42px]">Add transport data</p>
                    <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                      Import freight records to calculate intensity
                    </p>
                  </div>
                </Link>
              </>
            )}
            {industryData.type === "facilities_management" && (
              <>
                <MetricCard
                  icon={Gauge}
                  label="Building energy (Scope 2)"
                  value={industryData.energyKgCo2e >= 1000
                    ? `${(industryData.energyKgCo2e / 1000).toFixed(2)} tCO₂e`
                    : `${industryData.energyKgCo2e.toFixed(1)} kgCO2e`}
                  detail={`${industryData.energyRecords} electricity records`}
                />
                <Link
                  href={`/orgs/${orgId}/records?scope=2`}
                  className="flex flex-col justify-between rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-[21px] transition-colors hover:bg-[#FFEDD5]"
                >
                  <div className="flex items-center gap-2">
                    <LineChart aria-hidden="true" className="h-4 w-4 text-[#111827]" />
                    <p className="text-xs font-normal uppercase tracking-wide text-[#111827]">Energy intensity</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-normal text-[#111827] tracking-[-0.42px]">Add floor area</p>
                    <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                      Import m² data to compute kgCO2e/m²
                    </p>
                  </div>
                </Link>
              </>
            )}
            {industryData.type === "public_procurement" && (
              <>
                <MetricCard
                  icon={ShieldCheck}
                  label="PPN 006 CRP status"
                  value={industryData.crpStatus === "ready" ? "Ready" : industryData.crpStatus ?? "Not generated"}
                  detail={industryData.crpDate ? `Last generated ${industryData.crpDate}` : "Generate a Carbon Reduction Plan report"}
                  href={`/orgs/${orgId}/reports`}
                  tone={industryData.crpStatus === "ready" ? "good" : "neutral"}
                />
                <Link
                  href={`/orgs/${orgId}/reports`}
                  className="flex flex-col justify-between rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-[21px] transition-colors hover:bg-[#FFEDD5]"
                >
                  <div className="flex items-center gap-2">
                    <Handshake aria-hidden="true" className="h-4 w-4 text-[#111827]" />
                    <p className="text-xs font-normal uppercase tracking-wide text-[#111827]">Procurement</p>
                  </div>
                  <div className="mt-3">
                    <p className="text-base font-normal text-[#111827] tracking-[-0.42px]">Generate CRP report</p>
                    <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                      PPN 006/21 compliant Carbon Reduction Plan
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>
        </section>
      )}

    </>
  );
  widgetNodes["waste-kpis"] = <WasteKpisWidget orgId={orgId} />;
  widgetNodes["environment"] = (
    <>
      {hasEnvironmentalData && (
        <section aria-label="Water and waste" className="mt-8">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
            Water &amp; waste (ESRS E3 / E5)
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Droplets}
              label="Water withdrawal"
              value={`${(environmentalTotals.water_withdrawal ?? 0).toLocaleString(L, { maximumFractionDigits: 1 })} m3`}
              detail="This reporting period"
              href={`/orgs/${orgId}/water`}
            />
            <MetricCard
              icon={Droplets}
              label="Water consumption"
              value={`${(environmentalTotals.water_consumption ?? 0).toLocaleString(L, { maximumFractionDigits: 1 })} m3`}
              detail="This reporting period"
              href={`/orgs/${orgId}/water`}
            />
            <MetricCard
              icon={Trash2}
              label="Waste generated"
              value={`${(environmentalTotals.waste_generated ?? 0).toLocaleString(L, { maximumFractionDigits: 2 })} t`}
              detail={wasteDiversionPct != null ? `${wasteDiversionPct}% diverted from disposal` : "This reporting period"}
              href={`/orgs/${orgId}/waste`}
            />
            <MetricCard
              icon={AlertTriangle}
              label="Hazardous waste"
              value={`${(environmentalTotals.waste_hazardous ?? 0).toLocaleString(L, { maximumFractionDigits: 2 })} t`}
              detail="This reporting period"
              href={`/orgs/${orgId}/waste`}
              tone={environmentalTotals.waste_hazardous ? "bad" : "neutral"}
            />
          </div>
        </section>
      )}

    </>
  );
  widgetNodes["operations"] = (
    <>
      <p className="mt-8 mb-3 text-[10px] font-medium uppercase tracking-widest text-[#6B7280]">
        Operations
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Activity records"
          value={recordCount.toLocaleString(L)}
          detail={`${formatPercent(approvedRecordCount, recordCount)} approved`}
        />
        <MetricCard
          icon={Inbox}
          label="Open field submissions"
          value={pendingSubmissionCount.toLocaleString(L)}
          detail="Awaiting triage or reviewer action"
        />
        <MetricCard
          icon={Upload}
          label="Import batches"
          value={importCount.toLocaleString(L)}
          detail={failedImportCount > 0 ? `${failedImportCount} need attention` : "No failed imports"}
        />
        <MetricCard
          icon={FileText}
          label="Reports"
          value={readyReportCount.toLocaleString(L)}
          detail={`${reportCount.toLocaleString(L)} total requested`}
        />
      </div>

    </>
  );
  widgetNodes["scope-breakdown"] = (
    <>
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
              <BklitScopeRing data={scopeDonutData} />
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
              <BklitCategoryBar
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
                <BklitTrendArea data={trendData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </>
  );
  widgetNodes["facilities"] = (
    <>
      {facilityRows.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 aria-hidden="true" className="h-4 w-4 text-[#111827]" />
                  <CardTitle className="text-base">By facility</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  CO₂e breakdown by facility for the current reporting period.
                  {activeFacility && (
                    <span className="ml-1 font-normal text-[#111827]">
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
                      ? "bg-[#c2410c] text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
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
                        ? "bg-[#c2410c] text-white"
                        : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
                    }`}
                  >
                    {fac.name}
                  </Link>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#f9fafb]">
                    <th className="px-4 py-3 text-left text-xs font-normal uppercase tracking-wide text-[#374151]">
                      Facility
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">
                      Total CO₂e
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">
                      Share
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-normal uppercase tracking-wide text-[#374151]">
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
                          selectedFacilityId === fac.id ? "bg-[#FFF7ED]/60" : "hover:bg-[#f9fafb]"
                        }
                      >
                        <td className="px-4 py-3 font-normal text-[#111827] tracking-[-0.42px]">
                          {fac.name}
                        </td>
                        <td className="px-4 py-3 text-right font-normal text-[#111827] tracking-[-0.42px]">
                          {formatKgCo2e(L, fac.totalCo2e)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#FFF7ED]">
                              <div
                                className="h-full rounded-full bg-[#c2410c]"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-xs text-[#374151] tracking-[-0.36px]">
                              {share}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[#374151] tracking-[-0.36px]">
                          {fac.recordCount.toLocaleString(L)}
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

    </>
  );
  widgetNodes["scope-detail"] = (
    <>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emissions by scope</CardTitle>
            <CardDescription>
              Aggregates rebuilt from immutable calculation runs.
              {activeFacility && (
                <span className="ml-1 font-normal text-[#111827]">
                  Showing all scopes — facility filter applies to the breakdown table above.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasAggregates ? (
              <div className="grid gap-3 md:grid-cols-3">
                {scopeRows.map((row) => (
                  <div key={row.scope} className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
                    <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">
                      Scope {row.scope}
                    </p>
                    <p className="mt-2 text-2xl font-normal tracking-[-0.4px] text-[#111827]">
                      {formatKgCo2e(L, row.total)}
                    </p>
                    <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                      {Number(row.records).toLocaleString(L)} calculated records
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

        {priorPeriod && priorScopeRows.some((r) => Number(r.total) > 0) && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-[#111827]" />
                    <CardTitle className="text-base">Year-on-year comparison</CardTitle>
                  </div>
                  <CardDescription className="mt-1">
                    {currentPeriod?.label} vs {priorPeriod.label} — scope-level emissions delta.
                  </CardDescription>
                </div>
                <Badge variant="outline">{priorPeriod.label} to {currentPeriod?.label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {[1, 2, 3].map((scope) => {
                  const current = scopeRows.find((r) => r.scope === scope);
                  const prior = priorScopeRows.find((r) => r.scope === scope);
                  const currentVal = Number(current?.total ?? 0);
                  const priorVal = Number(prior?.total ?? 0);
                  const delta = currentVal - priorVal;
                  const deltaPct = priorVal > 0 ? (delta / priorVal) * 100 : null;
                  const improved = delta <= 0;
                  return (
                    <div key={scope} className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
                      <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Scope {scope}</p>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xl font-normal tracking-[-0.4px] text-[#111827]">{formatKgCo2e(L, currentVal)}</p>
                          <p className="text-xs text-[#374151]">{currentPeriod?.label}</p>
                        </div>
                        {deltaPct !== null && (
                          <div className={`flex items-center gap-1 text-sm font-medium ${improved ? "text-emerald-600" : "text-red-600"}`}>
                            {improved ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
                          </div>
                        )}
                      </div>
                      <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
                        <p className="text-xs text-[#6B7280]">{formatKgCo2e(L, priorVal)} in {priorPeriod.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

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

    </>
  );
  widgetNodes["data-quality"] = (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[#111827]" />
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
            <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#374151]">
                Emissions from reviewed records
              </dt>
              {dataConfidencePct !== null ? (
                <div className="mt-2 flex flex-col items-center gap-1">
                  <BklitDataGauge value={dataConfidencePct} label="Data confidence" size={160} />
                  <p className="text-xs text-[#374151] tracking-[-0.36px]">
                    of calculated CO₂e from approved records
                  </p>
                </div>
              ) : (
                <>
                  <dd className="mt-2 text-2xl font-normal tracking-[-0.4px] text-[#374151]">
                    —
                  </dd>
                  <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                    Run a calculation to see confidence
                  </p>
                </>
              )}
            </div>

            <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#374151]">
                Approved records missing evidence
              </dt>
              <dd
                className={`mt-2 text-2xl font-normal tracking-[-0.4px] ${
                  missingEvidenceCount > 0 ? "text-amber-600" : "text-[#111827]"
                }`}
              >
                {missingEvidenceCount.toLocaleString(L)}
              </dd>
              <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                Approved records with no linked evidence files
              </p>
            </div>

            <div className="rounded-[14px] border border-[#E5E7EB] p-[21px]">
              <dt className="text-xs font-normal uppercase tracking-wide text-[#374151]">
                Records pending attention
              </dt>
              <dd
                className={`mt-2 text-2xl font-normal tracking-[-0.4px] ${
                  pendingAttentionCount > 0 ? "text-amber-600" : "text-[#111827]"
                }`}
              >
                {pendingAttentionCount.toLocaleString(L)}
              </dd>
              <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
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
            {failedFigureCount > 0 && (
              <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {failedFigureCount} figure{failedFigureCount !== 1 ? "s" : ""} on this
                page could not be loaded and {failedFigureCount !== 1 ? "are" : "is"}{" "}
                shown as empty. {failedFigureCount !== 1 ? "These are" : "This is"} not
                a reading of zero. Refresh, and if it persists the database is
                unreachable rather than the data missing.
              </div>
            )}
            {staleSnapshots.length > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {staleSnapshots
                  .map((s) => `${s.period} (snapshot v${s.version}) was calculated with ${s.used.name} ${s.used.version}, since corrected by ${s.replacement.version}`)
                  .join("; ")}
                . Recalculate {staleSnapshots.length === 1 ? "that period" : "those periods"} with the corrected set and publish again so your reports use the right factors.{" "}
                <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Go to calculations</Link>
              </div>
            )}
            {outdatedSnapshots.length > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {outdatedSnapshots.map((s) => `${s.period} (snapshot v${s.version}) was calculated under ${s.used}`).join("; ")}.
                The current methodology is {outdatedSnapshots[0].current}
                {outdatedSnapshots[0].changes.length > 0 && `: ${outdatedSnapshots[0].changes.join(" ")}`}{" "}
                Published figures stay as they were; recalculate and publish again to use the current rules.{" "}
                <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Go to calculations</Link>
              </div>
            )}
            {carbonPrice && carbonPriceCost && carbonPriceCost.coveredTco2e > 0 && (
              <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#374151] tracking-[-0.42px]">
                At your {(PRICE_TYPES[carbonPrice.priceType as PriceType]?.label ?? "internal carbon price").toLowerCase()} of{" "}
                {formatMoney(carbonPrice.pricePerTonne, carbonPrice.currency, 2)}/tCO₂e, the Scope {carbonPrice.scopes.join(", ")} emissions
                on this page carry a carbon cost of{" "}
                <span className="font-medium text-[#111827]">{formatMoney(carbonPriceCost.cost, carbonPrice.currency)}</span>.{" "}
                <Link href={`/orgs/${orgId}/settings/carbon-price`} className="underline underline-offset-2">Carbon price</Link>
              </div>
            )}
            {noFactorCount > 0 && (
              <div role="alert" className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {noFactorCount} of {latestRunCalcCount} calculated record{latestRunCalcCount !== 1 ? "s" : ""} matched no emission factor in
                this run&apos;s library, so they count as 0 and the totals above are short by their emissions. Add your own
                factor for them, or recalculate on a library that covers them.{" "}
                <Link href={`/orgs/${orgId}/settings/factors`} className="underline underline-offset-2">Add your own factor</Link>
                {" · "}
                <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Open the run to see which records</Link>
              </div>
            )}
            {zeroCo2eCalcCount - noFactorCount > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {zeroCo2eCalcCount - noFactorCount} calculated record{zeroCo2eCalcCount - noFactorCount !== 1 ? "s" : ""} contributed 0 kg CO2e
                for another reason (a unit the factor could not use, or an input amount of zero), so the totals above
                exclude them. Open the calculation run to see each record&apos;s reason.{" "}
                <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Open calculations</Link>
              </div>
            )}
            {staleRecordCount > 0 && (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 tracking-[-0.42px]">
                <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0 align-text-bottom" />
                {staleRecordCount} record{staleRecordCount !== 1 ? "s" : ""} added since last calculation run — results may be outdated.{" "}
                <Link href={`/orgs/${orgId}/calculations`} className="underline underline-offset-2">Run a calculation</Link>
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

    </>
  );
  widgetNodes["analytics-reporting"] = (
    <>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-[#E5E7EB] bg-[#c2410c] text-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base text-white">Analytics workbench</CardTitle>
                <CardDescription className="text-white/85">
                  Category concentration and scope movement for the active reporting period.
                </CardDescription>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-white/10 text-white/85">
                <LineChart aria-hidden="true" className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">Top emission categories</p>
                  <p className="text-xs text-[#374151] tracking-[-0.36px]">
                    Ranked from current calculation aggregates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/orgs/${orgId}/lineage`} className="text-xs text-[#374151] underline underline-offset-2 hover:text-[#111827]">
                    Trace to source
                  </Link>
                  <Badge variant="outline">{currentPeriod?.label ?? "No period"}</Badge>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {topCategoryAggregates.length > 0 ? (
                  topCategoryAggregates.map((aggregate) => (
                    <ProgressRow
                      key={aggregate.id}
                      label={aggregate.emissionCategory?.name ?? "Uncategorised"}
                      meta={`Scope ${aggregate.emissionCategory?.scope ?? aggregate.scope} - ${aggregate.recordCount.toLocaleString(L)} records`}
                      value={formatKgCo2e(L, aggregate.totalCo2e)}
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
                value={currentCalculatedRecords.toLocaleString(L)}
                detail="Records included in current scope totals"
              />
              <InsightCard
                icon={BarChart3}
                label="Current footprint"
                value={formatKgCo2e(L, currentFootprint)}
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
                  locale={L}
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
                value={readyReportCount.toLocaleString(L)}
                detail="Downloadable report artefacts"
              />
              <InsightCard
                icon={AlertTriangle}
                label="Failed outputs"
                value={failedReportCount.toLocaleString(L)}
                detail="Require rerun or investigation"
              />
            </div>
          </CardContent>
        </Card>

        {pilotKitDocuments.length > 0 && (
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Pilot kit documentation</CardTitle>
                  <CardDescription>
                    Onboarding and setup guides tailored for your organization.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {pilotKitDocuments.map((doc) => (
                <a
                  key={doc.storageKey}
                  href={doc.downloadUrl || "#"}
                  download={doc.downloadUrl ? true : false}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                    doc.downloadUrl
                      ? "border-[#E5E7EB] hover:border-[#3B82F6] hover:bg-[#EFF6FF] cursor-pointer"
                      : "border-[#F3F4F6] bg-[#F9FAFB] cursor-not-allowed opacity-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111827]">{doc.name}</p>
                    <p className="text-xs text-[#6B7280]">{doc.audience}</p>
                  </div>
                  <Download className="h-4 w-4 text-[#3B82F6] ml-3 flex-shrink-0" />
                </a>
              ))}
              {pilotKitData?.data?.generatedAt && (
                <div className="pt-1 text-xs text-[#6B7280]">
                  Generated {new Date(pilotKitData.data.generatedAt).toLocaleDateString(L, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

    </>
  );
  widgetNodes["social-evidence"] = (
    <>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#FFF7ED] text-[#111827]">
                <Handshake aria-hidden="true" className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InsightCard
                icon={Target}
                label="Target ambition"
                value={formatKgCo2e(L, targetReductionTotal)}
                detail={`${targetCount.toLocaleString(L)} active target records`}
              />
              <InsightCard
                icon={TrendingUp}
                label="Expected initiative impact"
                value={formatKgCo2e(L, initiativeTotalImpact)}
                detail={`${initiativeCount.toLocaleString(L)} initiatives tracked`}
              />
              <InsightCard
                icon={Scale}
                label="Planned investment"
                value={formatCurrency(L, initiativeTotalCost)}
                detail="Cost recorded against initiatives"
              />
              <InsightCard
                icon={Handshake}
                label="TOMS social value"
                value={formatCurrency(L, socialValueStats._sum.valuePounds ?? 0)}
                detail={`${socialValueStats._count._all.toLocaleString(L)} TOMS records`}
              />
              <InsightCard
                icon={Route}
                label="Pending submissions"
                value={pendingSubmissionCount.toLocaleString(L)}
                detail="Awaiting review from field workers"
              />
            </div>
            <div className="rounded-[14px] border border-[#E5E7EB]">
              {initiativeStatusRows.length > 0 ? (
                <div className="divide-y divide-[#e5e7eb]">
                  {initiativeStatusRows.map((row) => (
                    <div key={row.status} className="flex items-center justify-between gap-4 p-3">
                      <div>
                        <p className="text-sm font-normal capitalize text-[#111827] tracking-[-0.42px]">
                          {row.status.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-[#374151] tracking-[-0.36px]">
                          {formatKgCo2e(L, row._sum.expectedImpactCo2e)} expected impact
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
              <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">Capture status</p>
              <div className="mt-3 space-y-3">
                {submissionStatusRows.length > 0 ? (
                  submissionStatusRows.map((row) => (
                    <PipelineRow
                      locale={L}
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
              <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">Document mix</p>
              <div className="mt-3 space-y-3">
                {submissionDocumentRows.length > 0 ? (
                  submissionDocumentRows.map((row) => (
                    <PipelineRow
                      locale={L}
                      key={row.documentType}
                      label={row.documentType.replaceAll("_", " ")}
                      count={row._count._all}
                      total={documentTotal}
                    />
                  ))
                ) : (
                  <div className="rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-5 text-sm text-[#374151] tracking-[-0.42px]">
                    Document type analytics appear when field submissions are received.
                  </div>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InsightCard
                  icon={Upload}
                  label="Evidence files"
                  value={evidenceFileCount.toLocaleString(L)}
                  detail="Stored and linked documents"
                />
                <InsightCard
                  icon={Route}
                  label="Field submissions"
                  value={pendingSubmissionCount.toLocaleString(L)}
                  detail="Pending review"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

    </>
  );
  widgetNodes["ops-health"] = (
    <>
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
          <div className="rounded-[14px] border border-[#E5E7EB]">
            {recentAuditLogs.length === 0 ? (
              <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
                <Clock aria-hidden="true" className="h-6 w-6 text-[#374151]" />
                <p className="mt-2 text-sm font-normal text-[#111827] tracking-[-0.42px]">No audit events yet</p>
                <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
                  Operational events appear here after users create, review, calculate, or publish data.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#e5e7eb]">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-start justify-between gap-4 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-normal text-[#111827] tracking-[-0.42px]">
                        {log.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-[#374151] tracking-[-0.36px]">
                        {log.resourceType} - {log.actor?.name ?? log.actor?.email ?? "System"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-[#374151] tracking-[-0.36px]">
                      {log.createdAt.toLocaleDateString(L, {
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

    </>
  );
  widgetNodes["review-queue"] = (
    <>
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

    </>
  );
  widgetNodes["run-calculation"] = (
    <>
      {["admin", "editor", "sustainability_director", "sustainability_manager", "operations_manager"].includes(role) && <Card id="run-calculation" className="mt-6 scroll-mt-6">
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
          <CalculationControls
            orgId={orgId}
            periods={reportingPeriods.map((p) => ({ id: p.id, label: p.label, endDate: p.endDate.toISOString() }))}
            approvedCountByPeriod={approvedCountByPeriod}
            methodologies={methodologies.map((item) => ({
              id: item.id,
              label: `${item.name} (${item.gwpVersion})`,
            }))}
            factorLibraries={currentFactorLibraries(factorLibraries)}
          />
          <CalculationRunsLive orgId={orgId} initialRuns={calculationRuns} />
        </CardContent>
      </Card>}

    </>
  );
  widgetNodes["quick-links"] = (
    <>
      <div className="grid gap-6 mt-6 md:grid-cols-2 xl:grid-cols-4">
        <ActionCard title="Records" description="Review committed activity data and evidence status." href={`/orgs/${orgId}/records`} />
        <ActionCard title="Imports" description="Upload, validate, and commit activity data batches." href={`/orgs/${orgId}/imports`} />
        <ActionCard title="Reports" description="Track report requests and signed output artefacts." href={`/orgs/${orgId}/reports`} />
        <ActionCard title="Targets" description="Manage reduction targets and operational initiatives." href={`/orgs/${orgId}/targets`} />
      </div>
    </>
  );
  widgetNodes["flow"] = sliceView && sliceView.flows.totalKg > 0 ? <LinkedSankey flows={sliceView.flows} locale={L} period={currentPeriod?.label} /> : null;
  widgetNodes["waterfall"] = changeSteps.length > 1 && currentPeriod && priorPeriod ? <LinkedWaterfall steps={changeSteps} locale={L} explain={{ orgId, currentPeriodId: currentPeriod.id, previousPeriodId: priorPeriod.id, aiAvailable: waterfallAi }} /> : null;
  const widgetShown: Record<string, boolean> = {
    live: Boolean(liveDashboardEnabled),
    industry: Boolean(industryData),
    environment: Boolean(hasEnvironmentalData),
    "scope-breakdown": Boolean(hasAggregates),
    flow: Boolean(sliceView && sliceView.flows.totalKg > 0),
    waterfall: changeSteps.length > 1,
    facilities: facilityRows.length > 0,
  };
  const storedLayout = await loadStoredLayout(orgId, session!.user.id).catch(onLoadFailure(() => ({ layout: null, source: "preset" as const })));
  const placedWidgets = resolveLayout(
    widgetsForRole(role).filter((w) => widgetShown[w.id] ?? true),
    storedLayout.layout,
    role,
  ).map((w) => ({ ...w, node: widgetNodes[w.id] }));

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
                  <LayoutDashboard className="h-4 w-4 text-[#111827]" />
                </div>
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
                  Overview
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Dashboard
              </h1>
              <p className="text-sm text-[#374151] font-normal mt-1">
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
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
      {/* Onboarding checklist — shown to admins until all setup steps are complete */}
      {role === "admin" && onboardingProgress && !onboardingProgress.isComplete && (() => {
        const completedSteps = new Set(onboardingProgress.completedSteps);
        const checklistSteps = [
          {
            label: "Organisation profile",
            description: "Set your industry and country",
            href: `/orgs/${orgId}/settings`,
            done: completedSteps.has("org_profile") || !!(organization.industry && organization.hqCountry),
          },
          {
            label: "Invite your team",
            description: "Add at least one other member",
            href: `/orgs/${orgId}/settings/members`,
            done: completedSteps.has("first_team_member"),
          },
          {
            label: "Create a reporting period",
            description: "Define your first reporting window",
            href: `/orgs/${orgId}/settings/periods`,
            done: completedSteps.has("reporting_period") || reportingPeriods.length > 0,
          },
          {
            label: "Import activity data",
            description: "Upload a CSV or enter records manually",
            href: `/orgs/${orgId}/imports`,
            done: completedSteps.has("first_import") || recordCount > 0,
          },
          {
            label: "Run your first calculation",
            description: "Calculate CO2e for your records",
            href: `/orgs/${orgId}/calculations`,
            done: completedSteps.has("first_calculation") || calculationRuns.length > 0,
          },
        ];
        return <OnboardingChecklist orgId={orgId} steps={checklistSteps} />;
      })()}

      {/* Quick setup links — shown to admins who skipped the wizard but haven't run a calculation yet */}
      {role === "admin" && onboardingProgress?.isComplete && calculationRuns.length === 0 && (
        <div className="mb-8 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-[#111827] tracking-[-0.42px]">Quick setup</h2>
              <p className="text-xs text-[#6B7280] tracking-[-0.36px] mt-0.5">
                Jump to any area to configure your organisation. This panel disappears once you run your first calculation.
              </p>
            </div>
            <Link href={`/orgs/${orgId}/onboarding`} className="text-xs text-[#6B7280] hover:text-[#374151] underline underline-offset-2 shrink-0 ml-4">
              Open setup guide
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {[
              { label: "Org settings", description: "Industry, country, currency", href: `/orgs/${orgId}/settings` },
              { label: "Invite team", description: "Add editors and reviewers", href: `/orgs/${orgId}/settings/members` },
              { label: "Reporting period", description: "Define your reporting window", href: `/orgs/${orgId}/settings/periods` },
              { label: "Contracts & projects", description: "Add sites and assign field workers", href: `/orgs/${orgId}/contracts` },
              { label: "Import data", description: "Upload CSV or enter records", href: `/orgs/${orgId}/imports` },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-2.5 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2.5 hover:bg-[#F3F4F6] hover:border-[#D1D5DB] transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5 text-[#6B7280] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-[#111827] tracking-[-0.36px]">{item.label}</p>
                  <p className="text-[11px] text-[#6B7280] tracking-[-0.33px] mt-0.5 leading-snug">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Role-contextual quick-action banner */}
      {role === "auditor" && (
        <div className="mb-6 rounded-[10px] border border-[#D1FAE5] bg-[#ECFDF5] px-4 py-3 flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0" />
          <span className="text-sm text-emerald-800 font-medium">Auditor view</span>
          <span className="text-sm text-emerald-700">You have read-only access to all emissions data and audit trails.</span>
          <div className="ml-auto flex items-center gap-2">
            <Link href={`/orgs/${orgId}/settings/audit`} className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900">Audit log</Link>
            <Link href={`/orgs/${orgId}/lineage`} className="text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-900">Trace a figure</Link>
          </div>
        </div>
      )}
      {role === "reviewer" && openReviewTaskCount > 0 && (
        <div className="mb-6 rounded-[10px] border border-[#FEF9C3] bg-[#FEFCE8] px-4 py-3 flex items-center gap-3">
          <ClipboardCheck className="h-4 w-4 text-yellow-700 shrink-0" />
          <span className="text-sm text-yellow-800 font-medium">{openReviewTaskCount} item{openReviewTaskCount !== 1 ? "s" : ""} awaiting review</span>
          <Link href={`/orgs/${orgId}/submissions`} className="ml-auto text-xs font-medium text-yellow-700 underline underline-offset-2 hover:text-yellow-900">Go to review queue</Link>
        </div>
      )}
      {role === "viewer" && (
        <div className="mb-6 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 flex items-center gap-3">
          <Layers className="h-4 w-4 text-zinc-500 shrink-0" />
          <span className="text-sm text-zinc-600">You have read-only access to this dashboard. Contact an admin to request edit permissions.</span>
        </div>
      )}

      <DashboardFilterBar filters={dashboardFilters} projects={projectOptions} socialValue={socialValueNote} />
      <ActiveCrossFilters chips={crossChips} recordsHref={recordsHref} />

      {/* Saved views: personal and shared sets of the filters below */}
      {viewRoles().includes(role) && (
        <div className="mb-3 flex items-center gap-2">
          <SavedViewsMenu
            orgId={orgId}
            surface="dashboard"
            filters={dashboardFilters}
            canShare={mayShare(role)}
            isAdmin={role === "admin"}
          />
        </div>
      )}

      {/* Group filter: legal entity (with its subsidiaries) and country */}
      {(groupEntities.length > 0 || groupCountries.length > 1) && (
        <div className="flex flex-col gap-2">
          {groupEntities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-normal text-[#374151] tracking-[-0.36px]">Filter by entity:</span>
              {[{ id: "", name: "All" }, ...groupEntities].map((e) => (
                <Link
                  key={e.id || "all"}
                  href={dashboardHref({ contractId: selectedContractId, entityId: e.id || undefined, country: selectedCountry })}
                  className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                    (selectedEntityId ?? "") === e.id
                      ? "bg-[#c2410c] text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
                  }`}
                >
                  {e.name}
                </Link>
              ))}
            </div>
          )}
          {groupCountries.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-normal text-[#374151] tracking-[-0.36px]">Filter by country:</span>
              {["", ...groupCountries].map((c) => (
                <Link
                  key={c || "all"}
                  href={dashboardHref({ contractId: selectedContractId, entityId: selectedEntityId, country: c || undefined })}
                  className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                    (selectedCountry ?? "") === c
                      ? "bg-[#c2410c] text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
                  }`}
                >
                  {c ? countryOf(c)?.name ?? c : "All"}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contract filter */}
      {activeContracts.length > 0 && (
        <div className="flex flex-col gap-3">
          {selectedContract && (
            <div className="flex items-center gap-2 rounded-[14px] border border-[#FED7AA] bg-[#FFF7ED]/20 px-4 py-3">
              <span className="text-sm font-normal text-[#111827] tracking-[-0.42px]">
                Filtering by contract: <strong>{selectedContract.name}</strong>
              </span>
              <Link
                href={`/orgs/${orgId}/dashboard`}
                className="ml-auto text-xs text-[#374151] underline hover:text-[#111827]"
              >
                Clear
              </Link>
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-normal text-[#374151] tracking-[-0.36px] mr-1">Filter by contract:</span>
            <Link
              href={`/orgs/${orgId}/dashboard`}
              className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                !selectedContractId
                  ? "bg-[#c2410c] text-white"
                  : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
              }`}
            >
              All
            </Link>
            {activeContracts.map((contract) => (
              <Link
                key={contract.id}
                href={dashboardHref({ contractId: contract.id, entityId: selectedEntityId, country: selectedCountry })}
                className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                  selectedContractId === contract.id
                    ? "bg-[#c2410c] text-white"
                    : "border border-[#E5E7EB] text-[#374151] hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
                }`}
              >
                {contract.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Unpublished changes: live figures moved since the last publish ── */}
      {snapshotDiverges && latestSnapshot && (() => {
        const deltaKg = liveTotalCo2e - snapshotTotalCo2e;
        const deltaT = Math.abs(deltaKg) / 1000;
        return (
          <div
            role="status"
            className="mt-2 mb-4 flex flex-col gap-3 rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="tracking-[-0.42px]">
              <AlertTriangle aria-hidden="true" className="inline h-4 w-4 mr-2 align-text-bottom" />
              <span className="font-medium">
                Unpublished changes: {deltaKg >= 0 ? "+" : "\u2212"}
                {deltaT.toLocaleString(L, { maximumFractionDigits: deltaT < 10 ? 2 : 1 })} tCO₂e
              </span>{" "}
              since snapshot v{latestSnapshot.version} ({formatKgCo2e(L, snapshotTotalCo2e)}). The figures below are live
              ({formatKgCo2e(L, liveTotalCo2e)}); reports still use the published snapshot until you publish again.
            </p>
            {latestPeriodRun && (
              <Link
                href={`/orgs/${orgId}/calculations/${latestPeriodRun.id}`}
                className="shrink-0 rounded-full bg-[#c2410c] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#9a3412]"
              >
                Review and publish
              </Link>
            )}
          </div>
        );
      })()}

      <DashboardGrid orgId={orgId} widgets={placedWidgets} isAdmin={role === "admin"} source={storedLayout.source} />
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
    tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-[#111827]";
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#374151]" />
        <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">{label}</p>
      </div>
      <p className={`mt-3 text-3xl font-normal tracking-[-0.4px] ${valueColor}`}>{value}</p>
      <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">{detail}</p>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-[14px] border border-[#E5E7EB] bg-white p-[21px] transition-colors hover:border-[#FED7AA] hover:bg-[#FFF7ED]"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-[21px]">{inner}</div>
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
    <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-[21px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">{label}</p>
          <p className="mt-2 text-xl font-normal tracking-[-0.4px] text-[#111827]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-[#374151] tracking-[-0.36px]">{detail}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[7px] bg-[#FFF7ED] text-[#111827]">
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
    <div className="rounded-[14px] border border-[#E5E7EB] p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-normal text-[#111827] tracking-[-0.42px]">{label}</p>
          <p className="mt-0.5 text-xs text-[#374151] tracking-[-0.36px]">{meta}</p>
        </div>
        <p className="shrink-0 text-sm font-normal text-[#111827] tracking-[-0.42px]">{value}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#FFF7ED]">
        <div className="h-full rounded-full bg-[#c2410c]" style={{ width }} />
      </div>
    </div>
  );
}

function PipelineRow({
  locale,
  label,
  count,
  total,
}: {
  locale: string;
  label: string;
  count: number;
  total: number;
}) {
  const percent = total > 0 ? (count / total) * 100 : 0;
  const width = `${Math.max(2, Math.min(100, percent))}%`;
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-normal capitalize text-[#374151] tracking-[-0.42px]">{label}</span>
        <span className="text-sm font-normal text-[#111827] tracking-[-0.42px]">{count.toLocaleString(locale)}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#FFF7ED]">
        <div className="h-full rounded-full bg-[#c2410c]" style={{ width }} />
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
      className="flex items-center justify-between rounded-[14px] border border-[#E5E7EB] p-[21px] transition-colors hover:bg-[#FFF7ED]"
    >
      <div>
        <p className="text-sm font-normal text-[#374151] tracking-[-0.42px]">{label}</p>
        <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">
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
  href,
  tone = "neutral",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  href?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const valueColor =
    tone === "good" ? "text-[#059669]" : tone === "bad" ? "text-red-700" : "text-[#111827]";
  const content = (
    <Card className={href ? "transition-shadow hover:shadow-md" : undefined}>
      <CardContent className="p-[21px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-normal text-[#374151] tracking-[-0.42px]">{label}</p>
            <p className={`mt-2 text-3xl font-normal tracking-[-0.4px] ${valueColor}`}>{value}</p>
            <p className="mt-1 text-xs text-[#374151] tracking-[-0.36px]">{detail}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-[7px] bg-[#FFF7ED] text-[#111827]">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
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
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[#E5E7EB] p-3">
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="h-4 w-4 text-[#374151]" />
        <span className="text-sm text-[#374151] tracking-[-0.42px]">{label}</span>
      </div>
      <span className="text-sm font-normal text-[#111827] tracking-[-0.42px]">{value}</span>
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
    <div className="rounded-[14px] border border-dashed border-[#FED7AA] bg-[#FFF7ED] p-[21px]">
      <p className="font-normal text-[#111827] tracking-[-0.42px]">{title}</p>
      <p className="mt-1 max-w-xl text-sm text-[#374151] tracking-[-0.42px]">{description}</p>
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
      <Card className="h-full transition-colors group-hover:border-[#FED7AA] group-hover:bg-[#FFF7ED]">
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}