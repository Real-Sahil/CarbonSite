export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

// POST /api/auth/revoke
//
// Revokes one or all sessions for the authenticated user.
// Body is optional:
//   {}                          → revoke the current (calling) session
//   { "all": true }             → revoke every session for this user
//   { "sessionId": "<id>" }     → revoke a specific session owned by this user

const BodySchema = z
  .object({
    all: z.boolean().optional(),
    sessionId: z.string().optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  try {
    const { session, user } = await requireSession();

    let body: z.infer<typeof BodySchema> = {};
    try {
      const text = await req.text();
      if (text) body = BodySchema.parse(JSON.parse(text));
    } catch {
      return apiError("INVALID_BODY", "Request body must be valid JSON.", 400);
    }

    const now = new Date();

    if (body?.all) {
      const { count } = await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return NextResponse.json({ revoked: count });
    }

    const targetId = body?.sessionId ?? session.id;

    // Verify the target session belongs to the calling user.
    const target = await prisma.session.findUnique({
      where: { id: targetId },
      select: { id: true, userId: true, revokedAt: true },
    });
    if (!target || target.userId !== user.id) {
      return apiError("NOT_FOUND", "Session not found.", 404);
    }
    if (target.revokedAt !== null) {
      return apiError("ALREADY_REVOKED", "Session is already revoked.", 409);
    }

    await prisma.session.update({
      where: { id: targetId },
      data: { revokedAt: now },
    });

    return NextResponse.json({ revoked: 1 });
  } catch (err) {
    return handleRouteError(err);
  }
}
