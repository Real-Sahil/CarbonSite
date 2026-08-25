export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import speakeasy from "speakeasy";

const MFADisableSchema = z.object({
  code: z.string().regex(/^[\dA-F]{6,8}$/).describe("6-digit TOTP code or 8-char backup code"),
});

/**
 * POST /api/account/mfa/disable
 * Disable two-factor authentication. Requires valid TOTP or backup code.
 *
 * Accessible by: authenticated users
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession();

    // Fetch user's MFA settings
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!userData?.twoFactorEnabled) {
      return apiError("MFA_NOT_ENABLED", "Two-factor authentication is not enabled on this account", 400);
    }

    // Parse and validate body
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("BAD_REQUEST", "Request body must be valid JSON", 400);
    }

    const parsed = MFADisableSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Invalid request", 400, parsed.error.flatten());
    }

    const { code } = parsed.data;

    // Try TOTP code first
    if (code.length === 6) {
      const isValidCode = speakeasy.totp.verify({
        secret: userData.twoFactorSecret || "",
        encoding: "base32",
        token: code,
        window: 2,
      });

      if (!isValidCode) {
        return apiError("INVALID_CODE", "The code is incorrect or has expired.", 400);
      }
    } else {
      // Try backup code
      const backupCodes = userData.twoFactorBackupCodes
        ? (JSON.parse(userData.twoFactorBackupCodes) as string[])
        : [];

      const codeIndex = backupCodes.indexOf(code);
      if (codeIndex === -1) {
        return apiError("INVALID_CODE", "The backup code is not valid.", 400);
      }

      // Remove used backup code
      backupCodes.splice(codeIndex, 1);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: JSON.stringify(backupCodes),
        },
      });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorBackupCodes: null,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await writeAuditLog({
      organizationId: "",
      actorUserId: user.id,
      action: "auth.mfa_disabled",
      resourceType: "User",
      resourceId: user.id,
      metadata: {
        email: user.email,
      },
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been disabled.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
