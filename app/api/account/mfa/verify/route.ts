export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { POLICIES } from "@/lib/security/rate-limit";
import speakeasy from "speakeasy";
import crypto from "crypto";

const MFAVerifySchema = z.object({
  secret: z.string().min(1).describe("TOTP secret from setup"),
  code: z.string().regex(/^\d{6}$/).describe("6-digit code from authenticator"),
  currentCode: z.string().regex(/^\d{6}$/).optional().describe("Current 6-digit code; required to replace an active secret"),
});

/**
 * POST /api/account/mfa/verify
 * Verify TOTP code and enable MFA on user account.
 * Must be called after POST /api/account/mfa/setup.
 *
 * Accessible by: authenticated users
 */
export async function POST(req: NextRequest) {
  try {
    const limited = await rateLimitRequest(req, { key: "mfa_verify", ...POLICIES.auth });
    if (limited) return limited;

    const { user } = await requireSession();

    // Parse and validate body
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("BAD_REQUEST", "Request body must be valid JSON", 400);
    }

    const parsed = MFAVerifySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    const { secret, code, currentCode } = parsed.data;

    // Replacing an active secret needs the current authenticator, or a stolen
    // session could swap in its own secret and keep the account's MFA.
    const current = await prisma.user.findUnique({
      where: { id: user.id },
      select: { twoFactorEnabled: true, twoFactorSecret: true },
    });
    if (current?.twoFactorEnabled) {
      const currentOk =
        !!current.twoFactorSecret &&
        !!currentCode &&
        speakeasy.totp.verify({ secret: current.twoFactorSecret, encoding: "base32", token: currentCode, window: 2 });
      if (!currentOk) {
        return apiError(
          "INVALID_CODE",
          "Enter the code from your current authenticator to change two-factor authentication.",
          400,
        );
      }
    }

    // Verify the code matches the secret (window=2 allows some clock skew)
    const isValidCode = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (!isValidCode) {
      return apiError(
        "INVALID_CODE",
        "The code is incorrect or has expired. Please try again.",
        400,
      );
    }

    // Generate backup codes (10 codes, 8 characters each)
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString("hex").toUpperCase(),
    );

    // Enable MFA on user account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
        updatedAt: new Date(),
      },
    });

    // Audit log
    await writeAuditLog({
      organizationId: "",
      actorUserId: user.id,
      action: "auth.mfa_enabled",
      resourceType: "User",
      resourceId: user.id,
      metadata: {
        email: user.email,
      },
    }).catch(() => null);

    return NextResponse.json(
      {
        success: true,
        message: "Two-factor authentication enabled successfully",
        backupCodes,
        warning: "Save these backup codes in a secure location. Each can be used once to sign in if you lose access to your authenticator.",
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
