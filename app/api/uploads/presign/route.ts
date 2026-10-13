export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireSession, ROLE_GROUPS } from "@/lib/auth/session";
import { PRESIGN_TTL, isValidStorageKey, presignUpload } from "@/lib/storage";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { presignUploadSchema } from "@/lib/validation/org";
import { prisma } from "@/lib/db";

// Only evidence is uploaded straight from a client. Imports, reports and branding are written by the server.
const EVIDENCE_KEY = /^org\/([^/]+)\/evidence\//;
// The roles that may POST evidence (app/api/orgs/[orgId]/evidence/route.ts).
const UPLOADER_ROLES: string[] = [...ROLE_GROUPS.editor, "field_worker"];

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = presignUploadSchema.parse(await req.json());
    const { filename: key, contentType } = body;

    const keyMatch = key.match(EVIDENCE_KEY);
    if (!keyMatch) {
      return apiError(
        "INVALID_KEY",
        "Storage key must be org/{orgId}/evidence/... for an evidence upload.",
        400,
      );
    }
    if (!isValidStorageKey(key)) {
      return apiError("INVALID_STORAGE_KEY", "Storage key is invalid.", 422);
    }

    const orgId = keyMatch[1];
    const membership = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId: session.user.id },
      },
    });
    if (!membership || !UPLOADER_ROLES.includes(membership.role)) {
      return apiError("FORBIDDEN", "You cannot upload evidence to this organisation.", 403);
    }

    const url = await presignUpload(key, contentType);

    return NextResponse.json({
      url,
      key,
      expiresAt: new Date(Date.now() + PRESIGN_TTL * 1000).toISOString(),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
