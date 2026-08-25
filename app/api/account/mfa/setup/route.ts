export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

const MFASetupSchema = z.object({
  // Empty body — just user's session
});

/**
 * POST /api/account/mfa/setup
 * Generate a new TOTP secret and QR code for two-factor setup.
 * User must call POST /api/account/mfa/verify with the code to enable.
 *
 * Accessible by: authenticated users
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession();

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name: `CarbonSite (${user.email})`,
      issuer: "CarbonSite",
      length: 32,
    });

    if (!secret.otpauth_url) {
      return apiError("INTERNAL_ERROR", "Failed to generate TOTP setup", 500);
    }

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return NextResponse.json({
      secret: secret.base32,
      qrCode,
      backupUrl: `/api/account/mfa/verify?method=backup`,
      message: "Scan with authenticator app or use backup codes. Call POST /api/account/mfa/verify with the code to confirm.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
