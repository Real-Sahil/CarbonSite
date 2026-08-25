export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { rateLimitKey } from "@/lib/security/rate-limit";

const RegisterSchema = z.object({
  token: z.string().min(1).max(4096),
  platform: z.enum(["android", "ios"]),
});

// POST /api/push-tokens — register or refresh an FCM device token.
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession();
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey("push-tokens", "register", user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 422);
    }

    const { token, platform } = parsed.data;

    // Upsert: if the token already exists update its owner (device changed user)
    // or platform; if new, create. Use the token as the unique key.
    await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.id, platform },
      create: { userId: user.id, token, platform },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}

// DELETE /api/push-tokens — deregister a token on sign-out.
export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession();
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token : null;
    if (!token) return apiError("VALIDATION_ERROR", "token is required.", 422);

    await prisma.deviceToken.deleteMany({
      where: { token, userId: user.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
