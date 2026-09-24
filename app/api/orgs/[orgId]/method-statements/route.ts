export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  version: z.string().default("1.0"),
  riskAssessmentText: z.string().optional().nullable(),
  methodText: z.string().optional().nullable(),
  ppeRequired: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const items = await prisma.methodStatement.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status: status as never }),
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, title: true, version: true, status: true,
        issuedAt: true, expiresAt: true, createdAt: true,
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    });

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = CreateSchema.parse(await req.json());

    const ms = await prisma.methodStatement.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        title: body.title,
        version: body.version,
        projectId: body.projectId ?? null,
        siteId: body.siteId ?? null,
        riskAssessmentText: body.riskAssessmentText ?? null,
        methodText: body.methodText ?? null,
        ppeRequired: body.ppeRequired ?? null,
        issuedAt: body.issuedAt ? new Date(body.issuedAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "method_statement.created",
      resourceType: "MethodStatement",
      resourceId: ms.id,
      metadata: { title: ms.title, version: ms.version },
    });

    return NextResponse.json(ms, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
