import { prisma } from "@/lib/db";

type ReviewTargetType =
  | "activity_record"
  | "import_batch"
  | "field_submission"
  | "report";

interface ResolvedTarget {
  label: string;
  detail: string;
  href: string;
}

export async function resolveReviewTarget({
  organizationId,
  type,
  targetId,
}: {
  organizationId: string;
  type: string;
  targetId: string;
}): Promise<ResolvedTarget | null> {
  const orgId = organizationId;

  switch (type as ReviewTargetType) {
    case "activity_record": {
      const record = await prisma.activityRecord.findUnique({
        where: { id: targetId },
        include: {
          emissionCategory: { select: { scope: true, name: true } },
          reportingPeriod: { select: { label: true } },
        },
      });
      if (!record || record.organizationId !== orgId) return null;
      return {
        label: record.sourceDescription ?? record.supplierName ?? "Activity record",
        detail: `Scope ${record.emissionCategory.scope} ${record.emissionCategory.name} — ${record.reportingPeriod.label}`,
        href: `/orgs/${orgId}/records/${targetId}`,
      };
    }
    case "import_batch": {
      const batch = await prisma.importBatch.findUnique({
        where: { id: targetId },
        select: { organizationId: true, sourceFilename: true, state: true },
      });
      if (!batch || batch.organizationId !== orgId) return null;
      return {
        label: batch.sourceFilename,
        detail: batch.state.replaceAll("_", " "),
        href: `/orgs/${orgId}/imports`,
      };
    }
    case "field_submission": {
      const submission = await prisma.fieldSubmission.findUnique({
        where: { id: targetId },
        select: { organizationId: true, documentType: true, status: true },
      });
      if (!submission || submission.organizationId !== orgId) return null;
      return {
        label: submission.documentType.replaceAll("_", " "),
        detail: submission.status.replaceAll("_", " "),
        href: `/orgs/${orgId}/submissions/${targetId}`,
      };
    }
    case "report": {
      const report = await prisma.report.findUnique({
        where: { id: targetId },
        include: { reportingPeriod: { select: { label: true } } },
      });
      if (!report || report.organizationId !== orgId) return null;
      return {
        label: `${report.type.replaceAll("_", " ")} report`,
        detail: `${report.status} — ${report.reportingPeriod.label}`,
        href: `/orgs/${orgId}/reports`,
      };
    }
    default:
      return null;
  }
}
