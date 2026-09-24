export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const CreateSchema = z.object({
  reference: z.string().min(1).max(100),
  issuingBody: z.string().min(1),
  noticeType: z.enum([
    "improvement_notice","prohibition_notice","enforcement_notice",
    "stop_notice","remediation_notice","warning_letter","statutory_notice",
  ]),
  issuedAt: z.string(),
  complianceDeadline: z.string().optional().nullable(),
  subject: z.string().min(1),
  requirements: z.string().optional().nullable(),
  facilityId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  permitId: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const notices = await prisma.enforcementNotice.findMany({
      where: { organizationId: orgId, ...(status && { status: status as never }) },
      orderBy: { issuedAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, reference: true, issuingBody: true, noticeType: true,
        status: true, issuedAt: true, complianceDeadline: true, compliedAt: true,
        subject: true, createdAt: true,
        facility: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    const hasMore = notices.length > take;
    const data = hasMore ? notices.slice(0, take) : notices;
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

    const existing = await prisma.enforcementNotice.findFirst({ where: { organizationId: orgId, reference: body.reference } });
    if (existing) return apiError("CONFLICT", "Notice reference already exists", 409);

    const notice = await prisma.enforcementNotice.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        reference: body.reference,
        issuingBody: body.issuingBody,
        noticeType: body.noticeType as never,
        issuedAt: new Date(body.issuedAt),
        complianceDeadline: body.complianceDeadline ? new Date(body.complianceDeadline) : null,
        subject: body.subject,
        requirements: body.requirements ?? null,
        facilityId: body.facilityId ?? null,
        siteId: body.siteId ?? null,
        permitId: body.permitId ?? null,
        ownerUserId: body.ownerUserId ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "enforcement_notice.created", resourceType: "EnforcementNotice", resourceId: notice.id,
      metadata: { reference: notice.reference, noticeType: notice.noticeType },
    });

    return NextResponse.json(notice, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
