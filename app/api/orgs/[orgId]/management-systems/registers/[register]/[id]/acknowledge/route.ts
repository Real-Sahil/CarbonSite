export const dynamic = "force-dynamic";

// A member confirms they have read the current approved version of a policy
// or controlled document.

import { NextRequest } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { MS_READERS } from "@/lib/management-systems/access";
import { isRegisterKey } from "@/lib/management-systems/registers/config";
import { AcknowledgeError, acknowledge } from "@/lib/management-systems/acknowledgements";

type Params = { params: Promise<{ orgId: string; register: string; id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, register, id } = await params;
    if (!isRegisterKey(register)) return apiError("NOT_FOUND", "Unknown register.", 404);
    const { session } = await requireOrgMember(orgId, ...MS_READERS);
    const ack = await acknowledge(orgId, register, id, session.user.id);
    return Response.json({ version: ack.version, acknowledgedAt: ack.acknowledgedAt }, { status: 201 });
  } catch (err) {
    if (err instanceof AcknowledgeError) return apiError(err.code, err.message, err.status);
    return handleRouteError(err);
  }
}
