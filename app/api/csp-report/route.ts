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
      return NextResponse.json({ ok: true }, { status: 204 });
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

    // Send critical violations to error tracking (Sentry)
    // Repeated violations from the same source indicate a real policy problem.
    if (process.env.SENTRY_DSN && report.disposition === "enforce") {
      // TODO: Integrate Sentry SDK once added to dependencies
      // Sentry.captureMessage(
      //   `CSP ${report["violated-directive"]}: ${report["blocked-uri"]}`,
      //   "warning",
      // );
    }

    return NextResponse.json({ ok: true }, { status: 204 });
  } catch (err) {
    console.error("[CSP Report Error]", err);
    return NextResponse.json({ ok: true }, { status: 204 });
  }
}
