import { prisma } from "@/lib/db";

export async function processSupplierPerformanceUpdate(orgId: string, supplierId: string) {
  // Get all users who are members of the supplier organization
  const supplierMembers = await prisma.organizationMembership.findMany({
    where: { organizationId: supplierId },
    select: { userId: true },
  });

  const supplierUserIds = supplierMembers.map((m) => m.userId);

  // Get all submissions from this supplier organization to the client organization
  const submissions = await prisma.fieldSubmission.findMany({
    where: {
      organizationId: orgId,
      submittedByUserId: { in: supplierUserIds },
    },
    orderBy: { createdAt: "asc" },
  });

  const approvedCount = submissions.filter((s) => s.status === "approved").length;
  const rejectedCount = submissions.filter((s) => s.status === "rejected").length;
  const submissionCount = submissions.length;

  const onTimeCount = submissions.filter((s) => {
    if (s.status !== "approved") return false;
    if (!s.requestedByDeadline || !s.submittedAt) return false;
    return s.submittedAt <= s.requestedByDeadline;
  }).length;

  // Calculate quality metrics from activity records linked to approved submissions
  const approvedSubmissionIds = submissions
    .filter((s) => s.status === "approved" && s.activityRecordId)
    .map((s) => s.activityRecordId!);

  const qualityScores = await prisma.emissionCalculation.findMany({
    where: {
      activityRecordId: {
        in: approvedSubmissionIds,
      },
    },
    select: { dataQualityScore: true },
  });

  const avgQualityScore =
    qualityScores.length > 0
      ? qualityScores.reduce((sum, q) => sum + q.dataQualityScore, 0) / qualityScores.length
      : null;

  let trend: string | null = null;
  if (qualityScores.length >= 3) {
    const recent = qualityScores.slice(-3);
    const recentAvg = recent.reduce((sum, q) => sum + q.dataQualityScore, 0) / recent.length;
    const overall = avgQualityScore;

    if (overall !== null) {
      if (recentAvg > overall + 5) {
        trend = "improving";
      } else if (recentAvg < overall - 5) {
        trend = "declining";
      } else {
        trend = "stable";
      }
    }
  }

  const completenessScore = avgQualityScore;
  const dataQualityScore = avgQualityScore;

  await prisma.supplierPerformance.upsert({
    where: {
      organizationId_supplierId: {
        organizationId: orgId,
        supplierId,
      },
    },
    update: {
      submissionCount,
      approvedCount,
      rejectedCount,
      onTimeCount,
      completenessScore,
      dataQualityScore,
      lastDataQualityTrend: trend,
    },
    create: {
      organizationId: orgId,
      supplierId,
      submissionCount,
      approvedCount,
      rejectedCount,
      onTimeCount,
      completenessScore,
      dataQualityScore,
      lastDataQualityTrend: trend,
    },
  });

  console.log(
    `[supplier-performance] updated ${supplierId}: ${submissionCount} submissions, ${approvedCount} approved, ${rejectedCount} rejected`,
  );
}
