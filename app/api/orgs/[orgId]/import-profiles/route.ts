export const dynamic = "force-dynamic";

/** GET/POST /api/orgs/{orgId}/import-profiles: ERP export profiles (column mapping plus ledger code rules). */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { profileBodySchema } from "@/lib/imports/profiles";
import { createProfile, unknownCategoryCodes } from "@/lib/imports/profile-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);
    const profiles = await prisma.importProfile.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, sourceSystem: true, updatedAt: true, _count: { select: { rules: true, importBatches: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ data: profiles });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const parsed = profileBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid profile.", 400, parsed.error.flatten());
    const unknown = await unknownCategoryCodes(parsed.data.spec);
    if (unknown.length) return apiError("UNKNOWN_CATEGORY", `Unknown emission category: ${unknown.join(", ")}.`, 400);

    const profile = await createProfile(orgId, parsed.data.name, parsed.data.spec).catch((err) => {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return null;
      throw err;
    });
    if (!profile) return apiError("PROFILE_EXISTS", "A profile with that name already exists.", 409);

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "import_profile.created",
      resourceType: "ImportProfile",
      resourceId: profile.id,
      metadata: { name: profile.name, sourceSystem: profile.sourceSystem, rules: parsed.data.spec.rules.length },
    });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
