import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { putObject, presignDownload, keys } from "@/lib/storage";
import { apiError, handleRouteError } from "@/lib/validation/api";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB — logos are small
const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

// Uploads a white-label report logo. Stored under org/{orgId}/branding/.
// Returns the storage key + a short-lived preview URL; the branding form
// persists the key via PUT /branding when the admin saves.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = rateLimitRequest(req, {
      key: rateLimitKey(orgId, "branding-logo", session.user.id),
      limit: 10,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return apiError("INVALID_REQUEST", "Expected multipart/form-data.", 400);
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiError("NO_FILE", "No logo file was provided.", 400);
    }

    const mime = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
    const ext = ALLOWED[mime];
    if (!ext) {
      return apiError(
        "UNSUPPORTED_TYPE",
        "Logo must be a PNG, JPEG, WEBP or SVG image.",
        422,
      );
    }
    if (file.size > MAX_LOGO_BYTES) {
      return apiError("TOO_LARGE", "Logo must be 2 MB or smaller.", 422);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = keys.brandingLogo(orgId, `logo-${randomUUID()}.${ext}`);
    await putObject(key, buffer, mime);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "branding.logo_uploaded",
      resourceType: "tenant_branding",
      resourceId: orgId,
      metadata: { key, bytes: file.size, mime },
    });

    const url = await presignDownload(key);
    return NextResponse.json({ key, url }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
