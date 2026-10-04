export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { aiAssistEnabled } from "@/lib/llm/org-consent";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { loadPeriodFacts } from "@/lib/insights/period-facts";
import { draftNarrative } from "@/lib/insights/draft-narrative";

type Ctx = { params: Promise<{ orgId: string; periodId: string }> };

// POST: a grounded AI first draft for a period, to review and edit. Nothing is saved.
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const { orgId, periodId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    if (!(await aiAssistEnabled(orgId))) {
      return apiError("AI_ASSIST_OFF", "AI assistance is off for this organisation. An admin can turn it on in Settings.", 409);
    }
    const limited = await rateLimitRequest(req, { key: rateLimitKey(orgId, "narrative-draft", session.user.id), limit: 10, windowMs: 60_000 });
    if (limited) return limited;
    const facts = await loadPeriodFacts(orgId, periodId);
    if (!facts) return apiError("NOT_FOUND", "Nothing is calculated for that period yet.", 404);
    const draft = await draftNarrative(facts);
    if ("rejected" in draft) return apiError("DRAFT_REJECTED", draft.rejected, 422);
    return NextResponse.json({ draft });
  } catch (err) {
    return handleRouteError(err);
  }
}
