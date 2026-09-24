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
  incidentType: z.enum([
    "near_miss","first_aid","medical_treatment","lost_time_injury",
    "riddor_reportable","dangerous_occurrence","occupational_disease","fatality",
  ]),
  occurredAt: z.string().datetime(),
  description: z.string().min(1),
  facilityId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  injuredPartyName: z.string().optional().nullable(),
  bodyPartAffected: z.enum([
    "head","neck","back","shoulder","arm","hand","finger",
    "leg","knee","foot","toe","multiple","other",
  ]).optional().nullable(),
  immediateAction: z.string().optional().nullable(),
  ppeWorn: z.boolean().default(true),
  toolboxTalkEvidence: z.string().optional().nullable(),
  lostTimeDays: z.number().int().min(0).default(0),
  riddorReportable: z.boolean().default(false),
  riddorReferenceNo: z.string().optional().nullable(),
  witnessNames: z.string().optional().nullable(),
  ownerUserId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.dataReaders);

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);

    const incidents = await prisma.hsIncidentReport.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status: status as never }),
      },
      orderBy: { occurredAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true,
        reference: true,
        incidentType: true,
        status: true,
        occurredAt: true,
        description: true,
        lostTimeDays: true,
        riddorReportable: true,
        createdAt: true,
        reportedBy: { select: { name: true } },
        owner: { select: { name: true } },
      },
    });

    const hasMore = incidents.length > take;
    const data = hasMore ? incidents.slice(0, take) : incidents;

    return NextResponse.json({
      data,
      nextCursor: hasMore ? data[data.length - 1]?.id : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = CreateSchema.parse(await req.json());

    const existing = await prisma.hsIncidentReport.findFirst({
      where: { organizationId: orgId, reference: body.reference },
    });
    if (existing) return apiError("CONFLICT", "Incident reference already exists", 409);

    const incident = await prisma.hsIncidentReport.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        reference: body.reference,
        incidentType: body.incidentType as never,
        occurredAt: new Date(body.occurredAt),
        description: body.description,
        facilityId: body.facilityId ?? null,
        siteId: body.siteId ?? null,
        projectId: body.projectId ?? null,
        injuredPartyName: body.injuredPartyName ?? null,
        bodyPartAffected: (body.bodyPartAffected as never) ?? null,
        immediateAction: body.immediateAction ?? null,
        ppeWorn: body.ppeWorn,
        toolboxTalkEvidence: body.toolboxTalkEvidence ?? null,
        lostTimeDays: body.lostTimeDays,
        riddorReportable: body.riddorReportable,
        riddorReferenceNo: body.riddorReferenceNo ?? null,
        witnessNames: body.witnessNames ?? null,
        reportedByUserId: session.user.id,
        ownerUserId: body.ownerUserId ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "hs_incident.reported",
      resourceType: "HsIncidentReport",
      resourceId: incident.id,
      metadata: { reference: incident.reference, incidentType: incident.incidentType },
    });

    return NextResponse.json(incident, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
