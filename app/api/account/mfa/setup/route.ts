export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { TOTP } from "otplib";
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

    const totp = new TOTP();

    // Generate a new secret
    const secret = totp.generateSecret();

    // Build the otpauth URL for QR code
    const otpauthUrl = totp.toURI({
      label: user.email,
      issuer: "CarbonSite",
      secret,
    });

    // Generate QR code as data URL
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    return NextResponse.json({
      secret,
      qrCode,
      backupUrl: `/api/account/mfa/verify?method=backup`,
      message: "Scan with authenticator app or use backup codes. Call POST /api/account/mfa/verify with the code to confirm.",
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
