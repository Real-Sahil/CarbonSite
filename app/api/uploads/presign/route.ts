import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { presignUpload } from "@/lib/storage";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { presignUploadSchema } from "@/lib/validation/org";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = presignUploadSchema.parse(await req.json());
    const { filename: key, contentType } = body;

    // Key must follow the org-scoped convention: org/{orgId}/...
    const keyMatch = key.match(/^org\/([^/]+)\//);
    if (!keyMatch) {
      return apiError(
        "INVALID_KEY",
        "Storage key must start with org/{orgId}/ following the required naming convention.",
        400,
      );
    }

    const orgId = keyMatch[1];

    // Verify the requester is a member of that org
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: session.user.id },
      },
    });

    if (!membership) {
      return apiError(
        "FORBIDDEN",
        "You are not a member of the organization this key belongs to.",
        403,
      );
    }

    const url = await presignUpload(key, contentType);

    return NextResponse.json({ url, key });
  } catch (err) {
    return handleRouteError(err);
  }
}
