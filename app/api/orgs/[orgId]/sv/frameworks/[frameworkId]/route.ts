export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateSvFrameworkSchema } from "@/lib/validation/org";

type RouteContext = { params: Promise<{ orgId: string; frameworkId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, frameworkId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders, "contract_manager");

    const framework = await prisma.svFramework.findUnique({
      where: { id: frameworkId },
      include: {
        themes: {
          orderBy: { sortOrder: "asc" },
          include: {
            outcomes: {
              orderBy: { sortOrder: "asc" },
              include: { measures: true, indicators: true },
            },
          },
        },
        _count: { select: { commitments: true } },
      },
    });

    if (!framework || framework.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Framework not found.", 404);
    }

    return NextResponse.json(framework);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, frameworkId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const framework = await prisma.svFramework.findUnique({ where: { id: frameworkId } });
    if (!framework || framework.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Framework not found.", 404);
    }

    const body = updateSvFrameworkSchema.parse(await req.json());

    if (body.isDefault) {
      await prisma.svFramework.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: frameworkId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.svFramework.update({
      where: { id: frameworkId },
      data: body,
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_framework.update",
      resourceType: "SvFramework",
      resourceId: frameworkId,
      metadata: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, frameworkId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const framework = await prisma.svFramework.findUnique({
      where: { id: frameworkId },
      include: { _count: { select: { commitments: true } } },
    });
    if (!framework || framework.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Framework not found.", 404);
    }
    if (framework._count.commitments > 0) {
      return apiError("CONFLICT", "Cannot delete framework with existing commitments.", 409);
    }

    await prisma.svFramework.delete({ where: { id: frameworkId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "sv_framework.delete",
      resourceType: "SvFramework",
      resourceId: frameworkId,
      metadata: { name: framework.name },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
