export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createSvFrameworkSchema } from "@/lib/validation/org";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "contract_manager", "editor", "reviewer", "viewer", "auditor",
    );

    const frameworks = await prisma.svFramework.findMany({
      where: { organizationId: orgId },
      include: {
        themes: {
          orderBy: { sortOrder: "asc" },
          include: {
            outcomes: {
              orderBy: { sortOrder: "asc" },
              include: { measures: true },
            },
          },
        },
        _count: { select: { commitments: true } },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(frameworks);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(
      orgId,
      "admin", "sustainability_director",
    );
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "sv-frameworks-create", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = createSvFrameworkSchema.parse(await req.json());

    // Slug uniqueness within org
    const existing = await prisma.svFramework.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug: body.slug } },
    });
    if (existing) {
      return apiError("CONFLICT", "Framework with this slug already exists.", 409);
    }

    // If setting as default, clear other defaults
    if (body.isDefault) {
      await prisma.svFramework.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const framework = await prisma.svFramework.create({
      data: {
        organizationId: orgId,
        name: body.name,
        slug: body.slug,
        version: body.version,
        description: body.description,
        isDefault: body.isDefault ?? false,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_framework.create",
      resourceType: "SvFramework",
      resourceId: framework.id,
      metadata: { name: body.name, slug: body.slug },
    });

    return NextResponse.json(framework, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
