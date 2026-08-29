import crypto from "crypto";

const VERIFICATION_SECRET = process.env.REPORT_VERIFICATION_SECRET || "dev-secret-key";
const TOKEN_EXPIRY_DAYS = 90;

interface VerificationPayload {
  reportId: string;
  orgId: string;
  issuedAt: number;
}

export function generateReportToken(reportId: string, orgId: string): string {
  const payload: VerificationPayload = {
    reportId,
    orgId,
    issuedAt: Date.now(),
  };

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64");

  const signature = crypto
    .createHmac("sha256", VERIFICATION_SECRET)
    .update(payloadB64)
    .digest("base64");

  return `${payloadB64}.${signature}`;
}

export function verifyReportToken(
  token: string
): VerificationPayload | null {
  try {
    const [payloadB64, signature] = token.split(".");

    if (!payloadB64 || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", VERIFICATION_SECRET)
      .update(payloadB64)
      .digest("base64");

    if (signature !== expectedSignature) {
      return null;
    }

    const payloadStr = Buffer.from(payloadB64, "base64").toString("utf-8");
    const payload: VerificationPayload = JSON.parse(payloadStr);

    const now = Date.now();
    const tokenAge = now - payload.issuedAt;
    const expiryMs = TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

    if (tokenAge > expiryMs) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}
