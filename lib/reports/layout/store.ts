import { prisma } from "@/lib/db";
import { layoutSchema, normaliseLayout, type LayoutInput, type ResolvedBlock } from "./index";

/** The organisation's saved layout for a report type, resolved; the catalogue default when none is saved. */
export async function loadReportLayout(orgId: string, reportType: string): Promise<ResolvedBlock[]> {
  const row = await prisma.reportLayout.findUnique({
    where: { organizationId_reportType: { organizationId: orgId, reportType } },
    select: { blocks: true },
  });
  const parsed = row ? layoutSchema.safeParse({ blocks: row.blocks }) : null;
  return normaliseLayout(reportType, parsed?.success ? parsed.data : null);
}

/** Saves the layout (already validated) and returns the new version. */
export async function saveReportLayout(orgId: string, reportType: string, userId: string, input: LayoutInput) {
  const blocks = normaliseLayout(reportType, input).map((b) => ({
    id: b.id,
    ...(b.hidden ? { hidden: true } : {}),
    ...(b.title ? { title: b.title } : {}),
  }));
  const row = await prisma.reportLayout.upsert({
    where: { organizationId_reportType: { organizationId: orgId, reportType } },
    create: { organizationId: orgId, reportType, blocks, updatedByUserId: userId },
    update: { blocks, updatedByUserId: userId, version: { increment: 1 } },
    select: { version: true },
  });
  return { version: row.version, blocks };
}

/** Removes the saved layout so the report returns to the catalogue default. */
export async function resetReportLayout(orgId: string, reportType: string) {
  await prisma.reportLayout.deleteMany({ where: { organizationId: orgId, reportType } });
}
