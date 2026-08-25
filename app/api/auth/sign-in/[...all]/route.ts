export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAccountLocked, recordFailedLogin } from "@/lib/security/rate-limit-async";
import { clearAccountLockout } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    console.log("[sign-in] Request URL:", req.nextUrl.pathname);

    // Clone request before reading body so we can pass a fresh copy to auth.handler()
    const clonedReq = req.clone();
    const body = await clonedReq.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.toLowerCase() : "";
    console.log("[sign-in] Email from body:", email ? email.substring(0, 5) + "..." : "none");

    if (email) {
      try {
        const locked = await isAccountLocked(email);
        console.log("[sign-in] Account locked check:", locked);
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
        console.error("Account lockout check failed:", lockoutError);
      }
    }

    // Delegate to Better Auth handler
    let response: Response;
    try {
      console.log("[sign-in] Calling auth.handler()");
      response = await auth.handler(req);
      console.log("[sign-in] Auth handler response status:", response.status);

      // Read and log response body for debugging
      const responseText = await response.text();
      console.log("[sign-in] Auth handler response body:", responseText.substring(0, 200));

      // Re-create response since we consumed the body
      response = new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (authError) {
      console.error("[sign-in] Auth handler error:", authError);
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
        console.log("[sign-in] Cleared account lockout for:", email);
      } catch (clearError) {
        console.error("Failed to clear account lockout:", clearError);
      }
      return response;
    }

    // If auth failed and we have an email, record the failed attempt
    if (response.status >= 400 && email) {
      try {
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (user) {
          console.log("[sign-in] User found, recording failed login");
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
        } else {
          console.log("[sign-in] User not found for email");
        }
      } catch (failureRecordError) {
        console.error("Failed to record login failure:", failureRecordError);
      }
    }

    console.log("[sign-in] Returning response with status:", response.status);
    return response;
  } catch (error) {
    console.error("[sign-in] Route error:", error);
    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred. Please try again.",
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return auth.handler(req);
}
