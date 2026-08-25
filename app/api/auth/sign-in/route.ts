export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAccountLocked, recordFailedLogin, clearAccountLockout } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Check if account is locked before attempting auth
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";

  if (email) {
    const locked = await isAccountLocked(email);
    if (locked) {
      return NextResponse.json(
        {
          code: "ACCOUNT_LOCKED",
          message: "Too many failed login attempts. Please try again in 30 minutes.",
        },
        { status: 429 },
      );
    }
  }

  // Delegate to Better Auth handler
  const response = await auth.handler(req);

  // If auth succeeded, clear any lockout for this account
  if (response.status === 200 && email) {
    clearAccountLockout(email);
    return response;
  }

  // If auth failed and we have an email, record the failed attempt
  if (response.status >= 400 && email) {
    // Only record failures for existing accounts (not "user not found")
    // We check this by looking up the email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (user) {
      const nowLocked = await recordFailedLogin(email);
      if (nowLocked) {
        return NextResponse.json(
          {
            code: "ACCOUNT_LOCKED",
            message: "Too many failed login attempts. Your account is locked for 30 minutes.",
          },
          { status: 429 },
        );
      }
    }
  }

  return response;
}
