export const dynamic = "force-dynamic";

// Emissions data completeness checker.
// Returns a coverage score per scope/category for a given reporting period,
// so the dashboard can show users exactly what's missing before they run
// a calculation.  No new DB table required — derived from existing records.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

// Minimum categories considered necessary for a credible GHG inventory.
// Scope 3 categories are advisory only (marked optional).
const REQUIRED_CATEGORIES: Record<string, { scope: number; name: string; optional?: boolean }> = {
  "s1-stationary":         { scope: 1, name: "Stationary combustion" },
  "s1-mobile":             { scope: 1, name: "Mobile combustion" },
  "s1-fugitive":           { scope: 1, name: "Fugitive emissions", optional: true },
  "s2-electricity-lb":     { scope: 2, name: "Electricity (location-based)" },
  "s3-business-travel":    { scope: 3, name: "Business travel", optional: true },
  "s3-purchased-goods":    { scope: 3, name: "Purchased goods & services", optional: true },
  "s3-upstream-transport": { scope: 3, name: "Upstream transport", optional: true },
  "s3-commuting":          { scope: 3, name: "Employee commuting", optional: true },
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "auditor");

    const url = new URL(req.url);
    const reportingPeriodId = url.searchParams.get("reportingPeriodId");

    // Resolve reporting period — default to the most recently created open period.
    let periodId = reportingPeriodId;
    if (!periodId) {
      const latest = await prisma.reportingPeriod.findFirst({
        where: { organizationId: orgId, status: "draft" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      periodId = latest?.id ?? null;
    }

    if (!periodId) {
      return NextResponse.json({
        periodId: null,
        score: 0,
        categories: [],
        missingRequired: Object.keys(REQUIRED_CATEGORIES).filter(
          (c) => !REQUIRED_CATEGORIES[c].optional,
        ),
        recommendations: ["Create a reporting period to begin tracking your emissions."],
      });
    }

    // Count committed records per category code for this period.
    const records = await prisma.activityRecord.groupBy({
      by: ["emissionCategoryId"],
      where: { organizationId: orgId, reportingPeriodId: periodId, reviewStatus: { not: "rejected" } },
      _count: { id: true },
    });

    // Fetch category codes for the ids we have.
    const categoryIds = records.map((r) => r.emissionCategoryId).filter(Boolean) as string[];
    const categories = categoryIds.length > 0
      ? await prisma.emissionCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, code: true, name: true, scope: true },
        })
      : [];

    const codeToCount = new Map<string, number>();
    for (const r of records) {
      const cat = categories.find((c) => c.id === r.emissionCategoryId);
      if (cat) codeToCount.set(cat.code, r._count.id);
    }

    // Also collect all categories that have records (even ones not in the required list).
    const allCatMap = new Map(categories.map((c) => [c.code, c]));

    const categoryResults = Object.entries(REQUIRED_CATEGORIES).map(([code, meta]) => {
      const count = codeToCount.get(code) ?? 0;
      return {
        code,
        scope: meta.scope,
        name: meta.name,
        optional: meta.optional ?? false,
        recordCount: count,
        covered: count > 0,
      };
    });

    // Add any extra categories beyond the required set that have records.
    for (const [code, cat] of allCatMap) {
      if (!REQUIRED_CATEGORIES[code]) {
        categoryResults.push({
          code,
          scope: cat.scope,
          name: cat.name,
          optional: true,
          recordCount: codeToCount.get(code) ?? 0,
          covered: true,
        });
      }
    }

    const required = categoryResults.filter((c) => !c.optional);
    const coveredRequired = required.filter((c) => c.covered).length;
    const score = required.length > 0
      ? Math.round((coveredRequired / required.length) * 100)
      : 0;

    const missingRequired = required.filter((c) => !c.covered).map((c) => c.code);
    const missingOptional = categoryResults.filter((c) => c.optional && !c.covered).map((c) => c.code);

    // Human-readable recommendations.
    const recommendations: string[] = [];
    if (missingRequired.includes("s1-stationary")) {
      recommendations.push("Add stationary combustion records (gas, oil, biomass) for Scope 1 completeness.");
    }
    if (missingRequired.includes("s1-mobile")) {
      recommendations.push("Add company vehicle and mobile plant fuel records for Scope 1 completeness.");
    }
    if (missingRequired.includes("s2-electricity-lb")) {
      recommendations.push("Add purchased electricity records for Scope 2 completeness — required for SECR.");
    }
    if (score >= 100 && missingOptional.length > 0) {
      recommendations.push(
        `Your required categories are complete. Consider adding Scope 3 data (${missingOptional.slice(0, 2).map((c) => REQUIRED_CATEGORIES[c]?.name ?? c).join(", ")}) for a full GHG Protocol inventory.`,
      );
    }
    if (score >= 100 && missingOptional.length === 0) {
      recommendations.push("Excellent — all standard emission categories are covered. You are ready to run a calculation.");
    }

    // SECR eligibility note (>250 employees or >£36m turnover).
    const secrEligibleCategories = ["s1-stationary", "s1-mobile", "s2-electricity-lb"];
    const secrReady = secrEligibleCategories.every((c) => codeToCount.get(c) ?? 0 > 0);

    return NextResponse.json({
      periodId,
      score,
      categories: categoryResults.sort((a, b) => a.scope - b.scope),
      missingRequired,
      missingOptional,
      recommendations,
      secrReady,
      secrNote: secrReady
        ? "Scope 1 and Scope 2 energy data is present. You can generate a SECR-compliant report."
        : "SECR requires Scope 1 (stationary + mobile combustion) and Scope 2 (electricity) records.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
