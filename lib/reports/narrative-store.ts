import { z } from "zod";
import { prisma } from "@/lib/db";
import type { AuditNarrative } from "./narrative-generator";

export const narrativeBody = z.object({
  executiveSummary: z.string().max(4000).default(""),
  keyFindings: z.array(z.string().trim().min(1).max(500)).max(12).default([]),
  recommendations: z.string().max(3000).default(""),
  aiDrafted: z.boolean().default(false),
});

/**
 * The organisation's own narrative for a period, shaped for the report, or null
 * when none has been saved (or the saved one is empty), so reports stay exactly
 * as they were until a person writes one. Always read inside the organisation.
 */
export async function loadTeamNarrative(orgId: string, periodId: string): Promise<AuditNarrative | null> {
  const row = await prisma.reportNarrative.findFirst({ where: { organizationId: orgId, reportingPeriodId: periodId } });
  if (!row) return null;
  const parsed = z.array(z.string()).safeParse(row.keyFindings);
  const findings = parsed.success ? parsed.data : [];
  if (!row.executiveSummary.trim() && findings.length === 0 && !row.recommendations.trim()) return null;
  return {
    executive_summary: row.executiveSummary,
    key_findings: findings,
    recommendations: row.recommendations,
    source: "team",
    aiDrafted: row.aiDrafted,
  };
}
