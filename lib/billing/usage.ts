import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type UsageEventType =
  | "field_submission.submitted"
  | "report.generated"
  | "import.committed"
  | "calculation.run"
  | "ocr.extraction"
  | "api.request";

export async function recordUsage(params: {
  organizationId: string;
  eventType: UsageEventType;
  quantity?: number;
  metadata?: Record<string, unknown>;
}) {
  await prisma.usageEvent.create({
    data: {
      organizationId: params.organizationId,
      eventType: params.eventType,
      quantity: params.quantity ?? 1,
      metadata: (params.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}

export async function getUsageSummary(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Record<string, number>> {
  const events = await prisma.usageEvent.groupBy({
    by: ["eventType"],
    where: {
      organizationId,
      recordedAt: { gte: periodStart, lte: periodEnd },
    },
    _sum: { quantity: true },
  });

  return Object.fromEntries(
    events.map((e) => [e.eventType, e._sum.quantity ?? 0]),
  );
}
