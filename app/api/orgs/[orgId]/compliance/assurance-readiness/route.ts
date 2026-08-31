export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

export interface AssuranceCheck {
  id: string;
  category: string;
  name: string;
  description: string;
  status: "pass" | "fail" | "partial" | "na";
  score: number; // 0-100
  detail: string;
  weight: number; // relative importance
}

export interface AssuranceReadinessResponse {
  overallScore: number; // 0-100
  assuranceLevel: "not_ready" | "limited" | "reasonable";
  checks: AssuranceCheck[];
  summary: {
    passed: number;
    failed: number;
    partial: number;
    total: number;
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "auditor");

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Run all checks in parallel
    const [
      activityRecords,
      snapshots,
      reports,
      auditLogs,
      fieldSubmissions,
      complianceRecords,
    ] = await Promise.all([
      prisma.activityRecord.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          reviewStatus: true,
          evidenceStatus: true,
          facilityId: true,
          emissionCategoryId: true,
          unit: true,
          amount: true,
          activityDate: true,
        },
      }),
      prisma.publishedSnapshot.findMany({
        where: { organizationId: orgId },
        select: { id: true, publishedAt: true, verifiedByUserId: true },
        orderBy: { publishedAt: "desc" },
        take: 10,
      }),
      prisma.report.findMany({
        where: { organizationId: orgId, status: "ready" },
        select: { id: true, type: true, createdAt: true },
        take: 20,
      }),
      prisma.auditLog.findMany({
        where: { organizationId: orgId, createdAt: { gte: ninetyDaysAgo } },
        select: { id: true, action: true, createdAt: true, previousHash: true },
        orderBy: { createdAt: "asc" },
        take: 500,
      }),
      prisma.fieldSubmission.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          status: true,
          files: { select: { id: true } },
        },
      }),
      prisma.complianceRecord.findMany({
        where: { organizationId: orgId },
        select: { framework: true, status: true, reportingYear: true },
      }),
    ]);

    const checks: AssuranceCheck[] = [];

    // ── 1. DATA COMPLETENESS ─────────────────────────────────────────────────
    const totalRecords = activityRecords.length;
    const approvedRecords = activityRecords.filter((r) => r.reviewStatus === "approved").length;
    const approvalRate = totalRecords > 0 ? (approvedRecords / totalRecords) * 100 : 0;

    checks.push({
      id: "data-completeness-approval",
      category: "Data Completeness",
      name: "Activity Record Approval Rate",
      description: "Percentage of activity records that have been reviewed and approved",
      status: approvalRate >= 90 ? "pass" : approvalRate >= 70 ? "partial" : totalRecords === 0 ? "fail" : "fail",
      score: Math.round(approvalRate),
      detail: `${approvedRecords} of ${totalRecords} records approved (${Math.round(approvalRate)}%)`,
      weight: 20,
    });

    const recordsWithEvidence = activityRecords.filter((r) => r.evidenceStatus !== "missing").length;
    const evidenceRate = totalRecords > 0 ? (recordsWithEvidence / totalRecords) * 100 : 0;
    checks.push({
      id: "evidence-coverage",
      category: "Data Completeness",
      name: "Evidence File Coverage",
      description: "Percentage of activity records with at least one supporting evidence file",
      status: evidenceRate >= 80 ? "pass" : evidenceRate >= 50 ? "partial" : "fail",
      score: Math.round(evidenceRate),
      detail: `${recordsWithEvidence} of ${totalRecords} records have evidence files (${Math.round(evidenceRate)}%)`,
      weight: 15,
    });

    // ── 2. AUDIT TRAIL INTEGRITY ──────────────────────────────────────────────
    const hasAuditLogs = auditLogs.length > 0;
    const logsWithHash = auditLogs.filter((l) => l.previousHash !== null).length;
    const hashChainRate = auditLogs.length > 0 ? (logsWithHash / auditLogs.length) * 100 : 0;

    checks.push({
      id: "audit-trail-exists",
      category: "Audit Trail",
      name: "Audit Log Presence",
      description: "System is recording immutable audit entries for all material operations",
      status: hasAuditLogs ? "pass" : "fail",
      score: hasAuditLogs ? 100 : 0,
      detail: `${auditLogs.length} audit entries in the last 90 days`,
      weight: 15,
    });

    checks.push({
      id: "audit-trail-hash-chain",
      category: "Audit Trail",
      name: "Hash Chain Integrity",
      description: "Audit log entries are linked via SHA-256 hash chain (tamper detection)",
      status: hashChainRate >= 95 ? "pass" : hashChainRate >= 50 ? "partial" : "fail",
      score: Math.round(hashChainRate),
      detail: `${logsWithHash} of ${auditLogs.length} log entries have hash chain linkage`,
      weight: 10,
    });

    // ── 3. PUBLISHED SNAPSHOTS ────────────────────────────────────────────────
    const hasSnapshots = snapshots.length > 0;
    const verifiedSnapshots = snapshots.filter((s) => s.verifiedByUserId !== null).length;
    const snapshotVerifyRate = snapshots.length > 0 ? (verifiedSnapshots / snapshots.length) * 100 : 0;

    checks.push({
      id: "published-snapshots",
      category: "Methodology",
      name: "Published Calculation Snapshots",
      description: "Organisation has published at least one immutable emissions calculation snapshot",
      status: hasSnapshots ? "pass" : "fail",
      score: hasSnapshots ? 100 : 0,
      detail: `${snapshots.length} published snapshot${snapshots.length !== 1 ? "s" : ""} on record`,
      weight: 10,
    });

    checks.push({
      id: "snapshot-verification",
      category: "Methodology",
      name: "Snapshot Management Review",
      description: "Published snapshots have been reviewed and verified by a named user (management sign-off)",
      status: snapshotVerifyRate >= 80 ? "pass" : snapshotVerifyRate > 0 ? "partial" : snapshots.length === 0 ? "fail" : "fail",
      score: Math.round(snapshotVerifyRate),
      detail: `${verifiedSnapshots} of ${snapshots.length} snapshots verified by a named reviewer`,
      weight: 10,
    });

    // ── 4. REPORTING ─────────────────────────────────────────────────────────
    const hasGhgReport = reports.some((r) => r.type === "ghg_protocol" || r.type === "csrd_esrs_e1");
    const hasAuditReport = reports.some((r) => r.type === "csrd_esrs_e1" || r.type === "secr");

    checks.push({
      id: "ghg-report",
      category: "Reporting",
      name: "GHG Report Generated",
      description: "At least one GHG Protocol or CSRD ESRS E1 report has been generated and is ready",
      status: hasGhgReport ? "pass" : "fail",
      score: hasGhgReport ? 100 : 0,
      detail: hasGhgReport
        ? `${reports.length} report(s) generated — types: ${[...new Set(reports.map((r) => r.type))].join(", ")}`
        : "No GHG Protocol or ESRS E1 reports generated yet",
      weight: 10,
    });

    checks.push({
      id: "statutory-reporting",
      category: "Reporting",
      name: "Statutory Report Coverage",
      description: "CSRD/SECR specific report available (required for limited assurance engagement)",
      status: hasAuditReport ? "pass" : "partial",
      score: hasAuditReport ? 100 : 30,
      detail: hasAuditReport
        ? "CSRD ESRS E1 or SECR report available"
        : "No CSRD or SECR-specific report — auditors may require this format",
      weight: 5,
    });

    // ── 5. COMPLIANCE RECORDS ─────────────────────────────────────────────────
    const submittedCompliance = complianceRecords.filter((r) => r.status === "submitted" || r.status === "verified").length;
    checks.push({
      id: "compliance-records",
      category: "Compliance",
      name: "Compliance Records Submitted",
      description: "Organisation has recorded submitted or verified compliance entries for relevant frameworks",
      status: submittedCompliance >= 2 ? "pass" : submittedCompliance >= 1 ? "partial" : "fail",
      score: Math.min(100, submittedCompliance * 25),
      detail: `${submittedCompliance} compliance record${submittedCompliance !== 1 ? "s" : ""} in submitted/verified status`,
      weight: 5,
    });

    // ── 6. FIELD SUBMISSIONS ──────────────────────────────────────────────────
    const totalSubmissions = fieldSubmissions.length;
    const submissionsWithFiles = fieldSubmissions.filter((s) => s.files.length > 0).length;
    const submissionFileRate = totalSubmissions > 0 ? (submissionsWithFiles / totalSubmissions) * 100 : 100;

    checks.push({
      id: "field-submission-evidence",
      category: "Data Completeness",
      name: "Field Submission Evidence",
      description: "Field worker submissions include photographic evidence (waste tickets, delivery notes)",
      status: totalSubmissions === 0 ? "na" : submissionFileRate >= 80 ? "pass" : submissionFileRate >= 50 ? "partial" : "fail",
      score: totalSubmissions === 0 ? 100 : Math.round(submissionFileRate),
      detail:
        totalSubmissions === 0
          ? "No field submissions recorded"
          : `${submissionsWithFiles} of ${totalSubmissions} field submissions have attached files (${Math.round(submissionFileRate)}%)`,
      weight: 0, // informational only when na
    });

    // ── SCORING ───────────────────────────────────────────────────────────────
    const relevantChecks = checks.filter((c) => c.status !== "na");
    const totalWeight = relevantChecks.reduce((sum, c) => sum + c.weight, 0);
    const weightedScore =
      totalWeight > 0
        ? relevantChecks.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0) / (totalWeight / 100)
        : 0;
    const overallScore = Math.round(weightedScore);

    const assuranceLevel: AssuranceReadinessResponse["assuranceLevel"] =
      overallScore >= 80 ? "reasonable" : overallScore >= 60 ? "limited" : "not_ready";

    const passed = checks.filter((c) => c.status === "pass").length;
    const failed = checks.filter((c) => c.status === "fail").length;
    const partial = checks.filter((c) => c.status === "partial").length;

    return NextResponse.json({
      overallScore,
      assuranceLevel,
      checks,
      summary: { passed, failed, partial, total: checks.filter((c) => c.status !== "na").length },
    } satisfies AssuranceReadinessResponse);
  } catch (err) {
    return handleRouteError(err);
  }
}
