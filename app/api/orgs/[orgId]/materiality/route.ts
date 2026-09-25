export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";
import { orgRefsError } from "@/lib/security/org-refs";

const CreateSchema = z.object({
  name: z.string().min(1).max(200),
  reportingPeriodId: z.string().optional().nullable(),
  esrsScope: z.string().optional().nullable(),
  methodologyNotes: z.string().optional().nullable(),
  stakeholderInput: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const assessments = await prisma.materialityAssessment.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, name: true, status: true, esrsScope: true,
        approvedAt: true, publishedAt: true, createdAt: true,
        reportingPeriod: { select: { id: true, label: true } },
        createdBy: { select: { name: true } },
        _count: { select: { topics: true } },
      },
    });

    const hasMore = assessments.length > take;
    const data = hasMore ? assessments.slice(0, take) : assessments;
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
    const refError = await orgRefsError(orgId, { reportingPeriodId: body.reportingPeriodId });
    if (refError) return refError;

    const assessment = await prisma.materialityAssessment.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        name: body.name,
        reportingPeriodId: body.reportingPeriodId ?? null,
        esrsScope: body.esrsScope ?? null,
        methodologyNotes: body.methodologyNotes ?? null,
        stakeholderInput: body.stakeholderInput ?? null,
        createdByUserId: session.user.id,
      },
    });

    await writeAuditLog({
      organizationId: orgId, actorUserId: session.user.id,
      action: "materiality.assessment_created", resourceType: "MaterialityAssessment", resourceId: assessment.id,
      metadata: { name: assessment.name },
    });

    return NextResponse.json(assessment, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
