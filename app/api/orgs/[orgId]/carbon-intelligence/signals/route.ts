export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createCarbonSignalSchema } from "@/lib/validation/org";
import { Decimal } from "@prisma/client/runtime/library";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "editor", "reviewer", "viewer", "auditor");

    const { searchParams } = new URL(req.url);
    const signalType = searchParams.get("signalType") ?? undefined;
    const region = searchParams.get("region") ?? undefined;
    const source = searchParams.get("source") ?? undefined;
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

    const signals = await prisma.carbonSignal.findMany({
      where: {
        organizationId: orgId,
        ...(signalType && { signalType }),
        ...(region && { region }),
        ...(source && { source }),
      },
      orderBy: { recordedAt: "desc" },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasMore = signals.length > limit;
    const items = hasMore ? signals.slice(0, limit) : signals;

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director", "sustainability_manager", "editor");

    const body = createCarbonSignalSchema.parse(await req.json());

    const signal = await prisma.carbonSignal.create({
      data: {
        organizationId: orgId,
        signalType: body.signalType,
        source: body.source,
        region: body.region ?? null,
        value: new Decimal(body.value),
        unit: body.unit,
        recordedAt: new Date(body.recordedAt),
        rawPayload: body.rawPayload ? (body.rawPayload as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "carbon_signal.ingested",
      resourceType: "CarbonSignal",
      resourceId: signal.id,
      metadata: { signalType: body.signalType, source: body.source, region: body.region },
    });

    // Auto-trigger alert evaluation: check if value exceeds threshold
    // (Threshold logic is pluggable — for now we just store the signal.)

    return NextResponse.json(signal, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
