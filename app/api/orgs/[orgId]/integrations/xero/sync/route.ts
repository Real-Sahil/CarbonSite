import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { enqueueXeroSync } from "@/lib/jobs/queues/index";
import { z } from "zod";

const syncRequestSchema = z.object({
  fromDate: z.string().datetime().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      ...ROLE_GROUPS.contractManagers
    );

    const body = await request.json();
    const { fromDate } = syncRequestSchema.parse(body);

    // Enqueue the sync job
    await enqueueXeroSync({
      orgId,
      fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
    });

    return NextResponse.json({
      queued: true,
      message: "Xero sync job queued",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * GET /orgs/[orgId]/integrations/xero/sync — Trigger sync (alternative to POST)
 * Supports ?fromDate=ISO8601 query parameter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      ...ROLE_GROUPS.contractManagers
    );

    const fromDate = request.nextUrl.searchParams.get("fromDate");

    // Validate the fromDate parameter if provided
    if (fromDate) {
      try {
        new Date(fromDate);
      } catch {
        return apiError("INVALID_DATE", "Invalid fromDate format. Use ISO8601.", 400);
      }
    }

    // Enqueue the sync job
    await enqueueXeroSync({
      orgId,
      fromDate: fromDate ?? undefined,
    });

    return NextResponse.json({
      queued: true,
      message: "Xero sync job queued",
      fromDate: fromDate ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
