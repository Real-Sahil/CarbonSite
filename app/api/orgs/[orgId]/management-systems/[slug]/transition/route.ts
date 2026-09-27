export const dynamic = "force-dynamic";

// Transition to a new edition of a standard (e.g. ISO 14001:2015 to 2026):
// adopts the new edition and carries statuses and evidence across.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_EDITORS } from "@/lib/management-systems/access";
import { TransitionError, transitionFramework } from "@/lib/management-systems/transition";

type Params = { params: Promise<{ orgId: string; slug: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, slug } = await params;
    const { session } = await requireOrgMember(orgId, ...MS_EDITORS);
    const result = await transitionFramework(orgId, slug, session.user.id);
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof TransitionError) return apiError(err.code, err.message, err.status);
    return handleRouteError(err);
  }
}
