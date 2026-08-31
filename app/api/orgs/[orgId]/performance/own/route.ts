export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string }> };

function extractAverageConfidence(ocrExtractedData: unknown): number | null {
  if (
    !ocrExtractedData ||
    typeof ocrExtractedData !== "object" ||
    Array.isArray(ocrExtractedData)
  ) {
    return null;
  }
  const confidence = (ocrExtractedData as Record<string, unknown>).confidence;
  if (!confidence || typeof confidence !== "object") return null;
  const scores = Object.values(confidence as Record<string, unknown>).filter(
    (v): v is number => typeof v === "number"
  );
  if (scores.length === 0) return null;
  return (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer");

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!organization) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Organization not found" },
        { status: 404 }
      );
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const submissions = await prisma.fieldSubmission.findMany({
      where: { organizationId: orgId, createdAt: { gte: ninetyDaysAgo } },
      select: {
        id: true,
        status: true,
        ocrExtractedData: true,
        submittedAt: true,
        requestedByDeadline: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const submissionCount = submissions.length;
    const approvedCount = submissions.filter((s) => s.status === "approved").length;
    const rejectedCount = submissions.filter((s) => s.status === "rejected").length;
    const withDeadline = submissions.filter((s) => s.requestedByDeadline && s.submittedAt);
    const onTimeCount = withDeadline.filter(
      (s) => s.submittedAt! <= s.requestedByDeadline!
    ).length;

    const confidenceScores = submissions
      .map((s) => extractAverageConfidence(s.ocrExtractedData))
      .filter((v): v is number => v !== null);
    const completenessScore =
      confidenceScores.length > 0
        ? confidenceScores.reduce((sum, v) => sum + v, 0) / confidenceScores.length
        : 0;

    const acceptanceRate = submissionCount > 0 ? (approvedCount / submissionCount) * 100 : 0;
    const onTimeRate =
      withDeadline.length > 0 ? (onTimeCount / withDeadline.length) * 100 : 0;
    const rejectionRate = submissionCount > 0 ? (rejectedCount / submissionCount) * 100 : 0;
    const dataQualityScore = (acceptanceRate + completenessScore) / 2;

    // Bucket into weekly history points across the 90-day window
    const buckets = new Map<
      string,
      { submissionCount: number; approvedCount: number; completeness: number[]; quality: number[] }
    >();
    for (const s of submissions) {
      const weekStart = new Date(s.createdAt);
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString();
      const bucket = buckets.get(key) || {
        submissionCount: 0,
        approvedCount: 0,
        completeness: [],
        quality: [],
      };
      bucket.submissionCount += 1;
      if (s.status === "approved") bucket.approvedCount += 1;
      const conf = extractAverageConfidence(s.ocrExtractedData);
      if (conf !== null) {
        bucket.completeness.push(conf);
        bucket.quality.push(conf);
      }
      buckets.set(key, bucket);
    }

    const history = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([recordedAt, bucket], index) => ({
        id: `own-${index}`,
        recordedAt,
        submissionCount: bucket.submissionCount,
        approvedCount: bucket.approvedCount,
        completenessScore:
          bucket.completeness.length > 0
            ? bucket.completeness.reduce((s, v) => s + v, 0) / bucket.completeness.length
            : 0,
        dataQualityScore:
          bucket.quality.length > 0
            ? bucket.quality.reduce((s, v) => s + v, 0) / bucket.quality.length
            : 0,
      }))
      .reverse();

    return NextResponse.json({
      performance: {
        id: "own",
        organizationId: orgId,
        supplierId: "own",
        submissionCount,
        approvedCount,
        rejectedCount,
        onTimeCount,
        completenessScore,
        dataQualityScore,
        acceptanceRate,
        onTimeRate,
        rejectionRate,
        lastDataQualityTrend: null,
        createdAt: organization.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
        supplier: { id: "own", name: organization.name },
      },
      history,
      metrics: {
        totalSubmissions: submissionCount,
        approvedSubmissions: approvedCount,
        rejectedSubmissions: rejectedCount,
        onTimeSubmissions: onTimeCount,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
