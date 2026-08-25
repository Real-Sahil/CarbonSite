export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAccountLocked, recordFailedLogin } from "@/lib/security/rate-limit-async";
import { clearAccountLockout } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    // Check if account is locked before attempting auth
    const body = await req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";

    if (email) {
      try {
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
      } catch (lockoutError) {
        // Log but don't block - account lockout check shouldn't break login
        console.error("Account lockout check failed:", lockoutError);
      }
    }

    // Delegate to Better Auth handler
    let response: Response;
    try {
      response = await auth.handler(req);
    } catch (authError) {
      console.error("Auth handler error:", authError);
      return NextResponse.json(
        {
          code: "AUTH_ERROR",
          message: "An error occurred during authentication. Please try again.",
        },
        { status: 500 },
      );
    }

    // If auth succeeded, clear any lockout for this account
    if (response.status === 200 && email) {
      try {
        clearAccountLockout(email);
      } catch (clearError) {
        console.error("Failed to clear account lockout:", clearError);
      }
      return response;
    }

    // If auth failed and we have an email, record the failed attempt
    if (response.status >= 400 && email) {
      try {
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
      } catch (failureRecordError) {
        console.error("Failed to record login failure:", failureRecordError);
      }
    }

    return response;
  } catch (error) {
    console.error("Sign-in route error:", error);
    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    );
  }
}
