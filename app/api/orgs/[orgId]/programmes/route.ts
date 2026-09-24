export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  programmeManagerUserId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  budgetTco2e: z.number().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const programmes = await prisma.programme.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status: status as never }),
      },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, name: true, status: true, clientName: true,
        startDate: true, endDate: true, budgetTco2e: true, createdAt: true,
        programmeManager: { select: { id: true, name: true } },
        _count: { select: { projects: true } },
      },
    });

    const hasMore = programmes.length > take;
    const data = hasMore ? programmes.slice(0, take) : programmes;
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

    const existing = await prisma.programme.findFirst({ where: { organizationId: orgId, name: body.name } });
    if (existing) return apiError("CONFLICT", "Programme name already exists", 409);

    const programme = await prisma.programme.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        name: body.name,
        description: body.description ?? null,
        clientName: body.clientName ?? null,
        programmeManagerUserId: body.programmeManagerUserId ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        budgetTco2e: body.budgetTco2e ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "programme.created", resourceType: "Programme", resourceId: programme.id,
      metadata: { name: programme.name },
    });

    return NextResponse.json(programme, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
