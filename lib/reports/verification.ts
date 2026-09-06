import crypto from "crypto";

const TOKEN_EXPIRY_DAYS = 90;

// Signs public report-verification tokens. No insecure fallback: if this is
// unset, anyone could forge a valid verification token for any report/org.
function getVerificationSecret(): string {
  const secret = process.env.REPORT_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error("REPORT_VERIFICATION_SECRET must be set — refusing to sign/verify with an insecure default.");
  }
  return secret;
}

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
    .createHmac("sha256", getVerificationSecret())
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
      .createHmac("sha256", getVerificationSecret())
      .update(payloadB64)
      .digest("base64");

    const expectedBuf = Buffer.from(expectedSignature, "utf8");
    const providedBuf = Buffer.from(signature, "utf8");
    const valid =
      expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf);
    if (!valid) {
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
