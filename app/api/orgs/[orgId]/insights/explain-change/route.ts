export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { orgRefsError } from "@/lib/security/org-refs";
import { prisma } from "@/lib/db";
import { orgFormat } from "@/lib/i18n/org-format";
import { loadPeriodCategoryTotals } from "@/lib/dashboard/slice-filter";
import { buildWaterfall } from "@/lib/charts/waterfall";
import { changeSummary, explainWithAi } from "@/lib/insights/change";

const body = z.object({ currentPeriodId: z.string().min(1).max(64), previousPeriodId: z.string().min(1).max(64), ai: z.boolean().default(false) });

// POST /api/orgs/[orgId]/insights/explain-change
// What moved between two periods, from the same live figures as the waterfall. The plain
// summary needs no model; `ai: true` adds a model's paragraph only when the organisation turned
// AI assistance on, and only when every figure in it is one we supplied.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const b = body.parse(await req.json());
    const bad = await orgRefsError(orgId, { reportingPeriodId: b.currentPeriodId });
    if (bad) return bad;
    const bad2 = await orgRefsError(orgId, { reportingPeriodId: b.previousPeriodId });
    if (bad2) return bad2;

    const [org, periods, totals] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true, reportingCurrency: true } }),
      prisma.reportingPeriod.findMany({ where: { organizationId: orgId, id: { in: [b.currentPeriodId, b.previousPeriodId] } }, select: { id: true, label: true } }),
      loadPeriodCategoryTotals(orgId, b.currentPeriodId, b.previousPeriodId),
    ]);
    const label = (id: string) => periods.find((p) => p.id === id)?.label ?? "the period";
    const steps = buildWaterfall(totals.previous, totals.current, { previous: label(b.previousPeriodId), current: label(b.currentPeriodId) });
    const summary = changeSummary(steps, orgFormat(org ?? {}).locale);
    if (!summary) return apiError("NOT_FOUND", "Nothing to compare for those periods.", 404);

    let ai: { text: string; provider: string } | null = null;
    let aiNote: string | null = null;
    if (b.ai) {
      if (!(await aiAssistEnabled(orgId))) {
        aiNote = "AI assistance is off for this organisation.";
      } else {
        const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "explain-change", session.user.id), limit: 10, windowMs: 60_000 });
        if (limited) return limited;
        try {
          const r = await explainWithAi(summary.facts);
          if ("rejected" in r) aiNote = r.rejected;
          else ai = r;
        } catch {
          aiNote = "The AI service is not available right now.";
        }
      }
    }
    return NextResponse.json({ sentences: summary.sentences, direction: summary.direction, ai, aiNote });
  } catch (err) {
    return handleRouteError(err);
  }
}
