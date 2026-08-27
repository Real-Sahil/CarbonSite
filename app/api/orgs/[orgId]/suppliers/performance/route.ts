import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    // Return empty list for now - will be populated once migration is applied
    return NextResponse.json({
      suppliers: [],
      pagination: {
        nextCursor: null,
        hasMore: false,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
