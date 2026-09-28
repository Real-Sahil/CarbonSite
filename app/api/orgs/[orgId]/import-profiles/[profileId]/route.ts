export const dynamic = "force-dynamic";

/** GET/PUT/DELETE /api/orgs/{orgId}/import-profiles/{profileId}. PUT replaces the whole rule table. */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { loadProfile, unknownCategoryCodes, updateProfile } from "@/lib/imports/profile-store";
import { profileBodySchema } from "@/lib/imports/profiles";

type Params = { params: Promise<{ orgId: string; profileId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, profileId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const profile = await loadProfile(orgId, profileId);
    if (!profile) return apiError("NOT_FOUND", "Import profile not found.", 404);
    return NextResponse.json({ profile });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, profileId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const parsed = profileBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid profile.", 400, parsed.error.flatten());
    const unknown = await unknownCategoryCodes(parsed.data.spec);
    if (unknown.length) return apiError("UNKNOWN_CATEGORY", `Unknown emission category: ${unknown.join(", ")}.`, 400);

    let profile;
    try {
      profile = await updateProfile(orgId, profileId, parsed.data.name, parsed.data.spec);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return apiError("PROFILE_EXISTS", "A profile with that name already exists.", 409);
      }
      throw err;
    }
    if (!profile) return apiError("NOT_FOUND", "Import profile not found.", 404);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import_profile.updated",
      resourceType: "ImportProfile",
      resourceId: profileId,
      metadata: { name: profile.name, rules: parsed.data.spec.rules.length },
    });
    return NextResponse.json({ profile });
  } catch (err) {
    return handleRouteError(err);
  }
}

/** Past imports keep the snapshot they were read with, so deleting a profile changes no batch. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, profileId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const deleted = await prisma.importProfile.deleteMany({ where: { id: profileId, organizationId: orgId } });
    if (deleted.count === 0) return apiError("NOT_FOUND", "Import profile not found.", 404);
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import_profile.deleted",
      resourceType: "ImportProfile",
      resourceId: profileId,
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
