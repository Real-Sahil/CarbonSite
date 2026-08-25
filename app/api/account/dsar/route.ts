export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { dispatchDsarErasure, dispatchDsarExport } from "@/lib/jobs/dispatch";
import { z } from "zod";

const createDsarRequestSchema = z.object({
  type: z.enum(["export", "erasure"]),
  organizationId: z.string().min(1).optional(),
});

// One calendar month, per the Art. 12(3) GDPR response deadline. setUTCMonth
// normalizes day-of-month overflow (e.g. 31 Jan + 1 month lands in March,
// not "Feb 31") — acceptable slack for a due-by SLA marker, not a ledger.
function oneCalendarMonthFrom(date: Date): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export async function GET() {
  try {
    const session = await requireSession();

    const requests = await prisma.dsarRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: requests });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = createDsarRequestSchema.parse(await req.json());

    // Idempotency: don't stack duplicate in-flight requests of the same type.
    const existing = await prisma.dsarRequest.findFirst({
      where: {
        userId: session.user.id,
        type: body.type,
        status: { in: ["pending", "processing"] },
      },
    });
    if (existing) {
      return NextResponse.json(existing, { status: 202 });
    }

    const requestedAt = new Date();
    const request = await prisma.dsarRequest.create({
      data: {
        userId: session.user.id,
        organizationId: body.organizationId,
        type: body.type,
        status: "pending",
        requestedAt,
        dueBy: oneCalendarMonthFrom(requestedAt),
        requestedByUserId: session.user.id,
      },
    });

    try {
      if (body.type === "export") {
        await dispatchDsarExport({ dsarRequestId: request.id });
      } else {
        await dispatchDsarErasure({ dsarRequestId: request.id });
      }
    } catch (err) {
      console.error(`[dsar] request ${request.id} dispatch failed:`, err);
      await prisma.dsarRequest.update({
        where: { id: request.id },
        data: { status: "failed" },
      });
      return apiError("INTERNAL_ERROR", "DSAR request could not be started.", 500);
    }

    return NextResponse.json(request, { status: 202 });
  } catch (err) {
    return handleRouteError(err);
  }
}
