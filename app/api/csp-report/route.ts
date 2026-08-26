export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

// CSP violation report endpoint for monitoring CSP policy effectiveness.
// Browsers send JSON reports here when CSP violations occur.
// Reports are logged for observability but do not block requests.
//
// Example CSP violation:
// {
//   "csp-report": {
//     "document-uri": "https://example.com/page",
//     "violated-directive": "script-src",
//     "effective-directive": "script-src",
//     "original-policy": "script-src 'self' 'nonce-abc123'; ...",
//     "blocked-uri": "https://evil.com/evil.js",
//     "status-code": 0,
//     "disposition": "enforce"
//   }
// }

type CSPReportBody = {
  "csp-report"?: {
    "document-uri"?: string;
    "violated-directive"?: string;
    "effective-directive"?: string;
    "original-policy"?: string;
    "blocked-uri"?: string;
    "status-code"?: number;
    "disposition"?: string;
  };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CSPReportBody;
    const report = body["csp-report"];

    if (!report) {
      return NextResponse.json({ ok: true });
    }

    const violation = {
      timestamp: new Date().toISOString(),
      documentUri: report["document-uri"],
      violatedDirective: report["violated-directive"],
      effectiveDirective: report["effective-directive"],
      blockedUri: report["blocked-uri"],
      statusCode: report["status-code"],
      disposition: report.disposition,
    };

    // Log the violation for observability
    console.warn("[CSP Violation]", violation);

    // Send violations to Sentry for monitoring
    if (process.env.SENTRY_DSN && report.disposition === "enforce") {
      const { captureMessage } = await import("@sentry/nextjs");
      captureMessage(
        `CSP violation: ${report["violated-directive"]} blocked ${report["blocked-uri"]} on ${report["document-uri"]}`,
        "warning",
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CSP Report Error]", err);
    return NextResponse.json({ ok: true });
  }
}
