import { prisma } from "@/lib/db";
import { securityLogger } from "@/lib/logger";

interface SupplierPerformanceEvent {
  supplierId: string;
  organizationId: string;
  submissionId: string;
  resolution: "approved" | "rejected";
  onTime: boolean;
  completenessScore: number;
}

export async function updateSupplierPerformance(
  event: SupplierPerformanceEvent
): Promise<void> {
  try {
    const { supplierId, organizationId, submissionId, resolution, onTime, completenessScore } = event;

    await prisma.$transaction(async (tx) => {
      let performance = await tx.supplierPerformance.findFirst({
        where: {
          organizationId,
          supplierId,
        },
      });

      if (!performance) {
        performance = await tx.supplierPerformance.create({
          data: {
            organizationId,
            supplierId,
            submissionCount: 0,
            approvedCount: 0,
            completenessScore: 0,
            dataQualityScore: 0,
          },
        });
      }

      const newSubmissionCount = performance.submissionCount + 1;
      const newApprovedCount =
        resolution === "approved"
          ? performance.approvedCount + 1
          : performance.approvedCount;

      const currentCompletenessNum = parseFloat(String(performance.completenessScore ?? 0));
      const newCompletenessScore =
        (currentCompletenessNum * performance.submissionCount +
          completenessScore) /
        newSubmissionCount;

      const approvalRate = (newApprovedCount / newSubmissionCount) * 100;
      const newDataQualityScore = (approvalRate + newCompletenessScore) / 2;

      const currentDataQuality = parseFloat(String(performance.dataQualityScore ?? 0));
      const trend = calculateTrend(
        currentDataQuality,
        newDataQualityScore
      );

      await tx.supplierPerformance.update({
        where: { id: performance.id },
        data: {
          submissionCount: newSubmissionCount,
          approvedCount: newApprovedCount,
          completenessScore: newCompletenessScore,
          dataQualityScore: newDataQualityScore,
          updatedAt: new Date(),
        },
      });

      await tx.supplierPerformanceHistory.create({
        data: {
          organizationId,
          supplierPerformanceId: performance.id,
          submissionCount: newSubmissionCount,
          approvedCount: newApprovedCount,
          completenessScore: newCompletenessScore,
          dataQualityScore: newDataQualityScore,
          recordedAt: new Date(),
        },
      });
    });

    securityLogger.info("Supplier performance updated", {
      organizationId,
      supplierId,
      submissionId,
      resolution,
    });
  } catch (error) {
    securityLogger.error("Error updating supplier performance", {
      organizationId: event.organizationId,
      supplierId: event.supplierId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function calculateTrend(
  previousScore: number,
  currentScore: number
): "improving" | "stable" | "declining" {
  const diff = currentScore - previousScore;
  if (diff > 5) return "improving";
  if (diff < -5) return "declining";
  return "stable";
}
