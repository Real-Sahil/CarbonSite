import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS, getSession } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { sendDigestEmail, compileDigestData } from "@/lib/notifications/digests";
import { z } from "zod";

const configSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
});

const sendManualSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly"]),
  recipientEmail: z.string().email().optional(),
});

/**
 * GET /api/orgs/[orgId]/digests
 * Get digest preferences and history.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    // In a real implementation, fetch from database
    // For now, return default preferences
    return NextResponse.json({
      preferences: {
        enabled: true,
        frequency: "weekly",
        dayOfWeek: 1, // Monday
      },
      lastSent: null,
      nextScheduled: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/digests
 * Configure digest preferences.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const session = await getSession();

    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED", "Not authenticated", 401);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = configSchema.parse(await request.json());

    // In a real implementation, update database
    // For now, just acknowledge the change
    return NextResponse.json({
      success: true,
      message: "Digest preferences updated",
      preferences: body,
      nextScheduled: body.enabled ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
