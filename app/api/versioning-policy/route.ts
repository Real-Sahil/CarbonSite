/**
 * GET /api/versioning-policy
 *
 * Public endpoint documenting CarbonSite API versioning policy.
 * No authentication required.
 */

import { NextResponse } from "next/server";
import { VERSIONING_POLICY, API_VERSIONS, type ApiVersionInfo } from "@/lib/api/versioning";

export async function GET() {
  const versions = Object.entries(API_VERSIONS).map(([version, info]: [string, ApiVersionInfo]) => ({
    version,
    status: info.status,
    deprecatedAt: info.deprecatedAt?.toISOString(),
    sunsetAt: info.sunsetAt?.toISOString(),
    recommendation: info.recommendation,
  }));

  return NextResponse.json({
    policy: VERSIONING_POLICY,
    versions,
    negotiation: {
      method: "Accept-Version header",
      example: "Accept-Version: 1.0",
      default: "1.0",
      fallback: "Latest stable version",
    },
    responseHeaders: {
      "API-Version": "Current API version returned",
      Deprecation: "Boolean flag if version is deprecated",
      Sunset: "ISO 8601 date when version becomes unavailable",
      "Deprecated-By": "Recommended version to migrate to",
    },
  });
}
