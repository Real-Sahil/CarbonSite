import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { writeAuditLog } from "@/lib/db/audit";
import { nanoid } from "nanoid";

const StartSchema = z.object({
  projectId: z.string().optional().nullable(),
  siteId: z.string().optional().nullable(),
  deviceInfo: z.string().optional().nullable(),
});

const PingSchema = z.object({
  sessionId: z.string(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  action: z.enum(["ping", "end"]).default("ping"),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const { searchParams } = new URL(req.url);
    const active = searchParams.get("active") === "true";
    const take = Math.min(parseInt(searchParams.get("take") ?? "25"), 100);
    const cursor = searchParams.get("cursor") ?? undefined;

    const sessions = await prisma.workerSession.findMany({
      where: {
        organizationId: orgId,
        ...(active && { endedAt: null }),
      },
      orderBy: { startedAt: "desc" },
      take: take + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      select: {
        id: true, startedAt: true, endedAt: true, lastPingAt: true,
        lastPingLat: true, lastPingLng: true, overdueAlert: true,
        user: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
      },
    });

    const hasMore = sessions.length > take;
    const data = hasMore ? sessions.slice(0, take) : sessions;
    return NextResponse.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "field_worker");

    const body = StartSchema.parse(await req.json());

    const ws = await prisma.workerSession.create({
      data: {
        id: nanoid(),
        organizationId: orgId,
        userId: session.user.id,
        projectId: body.projectId ?? null,
        siteId: body.siteId ?? null,
        deviceInfo: body.deviceInfo ?? null,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "worker_session.started",
      resourceType: "WorkerSession",
      resourceId: ws.id,
    });

    return NextResponse.json(ws, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer", "viewer", "field_worker");

    const body = PingSchema.parse(await req.json());

    const ws = await prisma.workerSession.findUnique({
      where: { id: body.sessionId },
      select: { organizationId: true, userId: true, endedAt: true },
    });
    if (!ws || ws.organizationId !== orgId) return apiError("NOT_FOUND", "Session not found", 404);
    if (ws.endedAt) return apiError("CONFLICT", "Session already ended", 409);

    const now = new Date();
    if (body.action === "end") {
      await prisma.workerSession.update({
        where: { id: body.sessionId },
        data: {
          endedAt: now,
          ...(body.lat !== undefined && { lastPingLat: body.lat }),
          ...(body.lng !== undefined && { lastPingLng: body.lng }),
          lastPingAt: now,
        },
      });
      await writeAuditLog({
        organizationId: orgId, actorUserId: session.user.id,
        action: "worker_session.ended", resourceType: "WorkerSession", resourceId: body.sessionId,
      });
    } else {
      await prisma.workerSession.update({
        where: { id: body.sessionId },
        data: {
          lastPingAt: now,
          ...(body.lat !== undefined && { lastPingLat: body.lat }),
          ...(body.lng !== undefined && { lastPingLng: body.lng }),
          overdueAlert: false,
        },
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
