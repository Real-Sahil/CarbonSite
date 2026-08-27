import { prisma } from "@/lib/db";

/**
 * Update supplier performance metrics after a field submission is reviewed
 * This function tracks submission quality and approval rates over time
 */
export async function updateSupplierPerformance(
  organizationId: string,
  supplierId: string,
  submissionId: string,
  approved: boolean,
  wasOnTime: boolean
) {
  try {
    // Upsert supplier performance record
    const performance = await prisma.supplierPerformance.upsert({
      where: {
        organizationId_supplierId: {
          organizationId,
          supplierId,
        },
      },
      create: {
        organizationId,
        supplierId,
        submissionCount: 1,
        approvedCount: approved ? 1 : 0,
        rejectedCount: approved ? 0 : 1,
        onTimeCount: wasOnTime ? 1 : 0,
      },
      update: {
        submissionCount: { increment: 1 },
        ...(approved && { approvedCount: { increment: 1 } }),
        ...(!approved && { rejectedCount: { increment: 1 } }),
        ...(wasOnTime && { onTimeCount: { increment: 1 } }),
        updatedAt: new Date(),
      },
    });

    // Calculate updated metrics
    const totalSubmissions = performance.submissionCount;
    const acceptanceRate =
      totalSubmissions > 0
        ? (performance.approvedCount / totalSubmissions) * 100
        : 0;

    // Determine quality trend based on recent submissions
    let trend: "improving" | "stable" | "declining" = "stable";
    if (approved && acceptanceRate > 80) {
      trend = "improving";
    } else if (!approved && acceptanceRate < 60) {
      trend = "declining";
    }

    // Update trend if changed
    if (performance.lastDataQualityTrend !== trend) {
      await prisma.supplierPerformance.update({
        where: {
          id: performance.id,
        },
        data: {
          lastDataQualityTrend: trend,
        },
      });
    }

    return performance;
  } catch (error) {
    console.error("Error updating supplier performance:", error);
    throw error;
  }
}

/**
 * Get supplier performance metrics
 */
export async function getSupplierPerformance(
  organizationId: string,
  supplierId: string
) {
  const performance = await prisma.supplierPerformance.findUnique({
    where: {
      organizationId_supplierId: {
        organizationId,
        supplierId,
      },
    },
  });

  if (!performance) return null;

  const totalSubmissions = performance.submissionCount;
  const acceptanceRate =
    totalSubmissions > 0
      ? (performance.approvedCount / totalSubmissions) * 100
      : 0;

  const onTimeRate =
    totalSubmissions > 0 ? (performance.onTimeCount / totalSubmissions) * 100 : 0;

  return {
    ...performance,
    acceptanceRate: Math.round(acceptanceRate * 100) / 100,
    onTimeRate: Math.round(onTimeRate * 100) / 100,
    rejectionRate: 100 - acceptanceRate,
  };
}

/**
 * Get list of all suppliers by performance metrics
 */
export async function getSupplierPerformanceList(
  organizationId: string,
  sortBy: "dataQualityScore" | "acceptanceRate" | "submissionCount" = "dataQualityScore",
  limit: number = 25
) {
  const suppliers = await prisma.supplierPerformance.findMany({
    where: {
      organizationId,
    },
    orderBy:
      sortBy === "acceptanceRate"
        ? { approvedCount: "desc" }
        : { [sortBy]: "desc" },
    take: limit,
  });

  return suppliers.map((item) => {
    const acceptanceRate =
      item.submissionCount > 0
        ? (item.approvedCount / item.submissionCount) * 100
        : 0;

    const onTimeRate =
      item.submissionCount > 0
        ? (item.onTimeCount / item.submissionCount) * 100
        : 0;

    return {
      ...item,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
    };
  });
}
