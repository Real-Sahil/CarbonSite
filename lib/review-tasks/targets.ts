import { prisma } from "@/lib/db";
import type { ReviewTaskType } from "@prisma/client";

export type ReviewTargetSummary = {
  id: string;
  type: ReviewTaskType;
  label: string;
  detail: string;
  href: string;
};

export async function resolveReviewTarget({
  organizationId,
  type,
  targetId,
}: {
  organizationId: string;
  type: ReviewTaskType;
  targetId: string;
}): Promise<ReviewTargetSummary | null> {
  if (type === "import_batch") {
    const batch = await prisma.importBatch.findFirst({
      where: { id: targetId, organizationId },
      select: {
        id: true,
        sourceFilename: true,
        state: true,
        errorCount: true,
        warningCount: true,
      },
    });
    if (!batch) return null;
    return {
      id: batch.id,
      type,
      label: batch.sourceFilename,
      detail: `${batch.state.replaceAll("_", " ")} - ${batch.errorCount} errors, ${batch.warningCount} warnings`,
      href: `/orgs/${organizationId}/imports`,
    };
  }

  if (type === "activity_record") {
    const record = await prisma.activityRecord.findFirst({
      where: { id: targetId, organizationId },
      include: {
        emissionCategory: { select: { scope: true, name: true } },
        reportingPeriod: { select: { label: true } },
      },
    });
    if (!record) return null;
    return {
      id: record.id,
      type,
      label: record.sourceDescription ?? record.supplierName ?? "Activity record",
      detail: `Scope ${record.emissionCategory.scope} ${record.emissionCategory.name} - ${record.reviewStatus.replaceAll("_", " ")} - ${record.reportingPeriod.label}`,
      href: `/orgs/${organizationId}/records`,
    };
  }

  const report = await prisma.report.findFirst({
    where: { id: targetId, organizationId },
    include: {
      reportingPeriod: { select: { label: true } },
    },
  });
  if (!report) return null;
  return {
    id: report.id,
    type,
    label: `${report.type.replaceAll("_", " ")} report`,
    detail: `${report.status.replaceAll("_", " ")} - ${report.reportingPeriod.label}`,
    href: `/orgs/${organizationId}/reports`,
  };
}
