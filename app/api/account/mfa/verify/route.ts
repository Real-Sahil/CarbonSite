export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import speakeasy from "speakeasy";
import crypto from "crypto";

const MFAVerifySchema = z.object({
  secret: z.string().min(1).describe("TOTP secret from setup"),
  code: z.string().regex(/^\d{6}$/).describe("6-digit code from authenticator"),
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

    const { secret, code } = parsed.data;

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
