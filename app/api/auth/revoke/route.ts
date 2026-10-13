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

    // Rows are deleted, not stamped: Better Auth ignores revokedAt, so only a missing row ends a session.
    if (body?.all) {
      const { count } = await prisma.session.deleteMany({ where: { userId: user.id } });
      return NextResponse.json({ revoked: count });
    }

    const targetId = body?.sessionId ?? session.id;

    // Scoped to the calling user: another user's session id matches no row.
    const { count: removed } = await prisma.session.deleteMany({
      where: { id: targetId, userId: user.id },
    });
    if (removed === 0) {
      return apiError("NOT_FOUND", "Session not found.", 404);
    }

    return NextResponse.json({ revoked: 1 });
  } catch (err) {
    return handleRouteError(err);
  }
}
