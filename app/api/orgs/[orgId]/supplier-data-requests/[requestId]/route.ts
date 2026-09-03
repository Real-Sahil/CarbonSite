import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

type Params = { params: Promise<{ orgId: string; requestId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    return NextResponse.json(
      { code: "NOT_IMPLEMENTED", message: "Supplier data requests are not yet available" },
      { status: 501 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
