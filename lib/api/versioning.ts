/**
 * API Versioning Framework
 *
 * Supports:
 * - Multiple API versions (/api/v1, /api/v2, etc.)
 * - Version negotiation via Accept-Version header
 * - Deprecation warnings and sunset dates
 * - Backward compatibility for 6 months minimum
 */

import { NextRequest, NextResponse } from "next/server";

export type ApiVersion = "1.0" | "2.0";
export type DeprecationLevel = "active" | "deprecated" | "sunset";

export interface ApiVersionInfo {
  version: ApiVersion;
  status: DeprecationLevel;
  deprecatedAt?: Date;
  sunsetAt?: Date;
  recommendation?: string;
}

export const API_VERSIONS: Record<ApiVersion, ApiVersionInfo> = {
  "1.0": {
    version: "1.0",
    status: "active",
  },
  "2.0": {
    version: "2.0",
    status: "active",
  },
};

const MINIMUM_DEPRECATION_WINDOW_MS = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months

/**
 * Negotiate API version from request headers
 * Priority: Accept-Version header > default version
 */
export function negotiateApiVersion(request: NextRequest): ApiVersion {
  const acceptVersion = request.headers.get("Accept-Version");

  if (acceptVersion) {
    const version = acceptVersion as ApiVersion;
    if (API_VERSIONS[version]) {
      return version;
    }
  }

  // Default to latest stable version
  return "1.0";
}

/**
 * Add versioning headers to response
 */
export function addVersionHeaders(
  response: NextResponse,
  version: ApiVersion,
  endpoint?: string
): NextResponse {
  const versionInfo = API_VERSIONS[version];

  response.headers.set("API-Version", version);
  response.headers.set("X-API-Version", version);

  // Add deprecation headers if version is deprecated
  if (versionInfo.status === "deprecated") {
    response.headers.set("Deprecation", "true");
    response.headers.set(
      "Warning",
      `299 - "API version ${version} is deprecated"`
    );

    if (versionInfo.sunsetAt) {
      const sunsetDate = versionInfo.sunsetAt.toISOString().split("T")[0];
      response.headers.set("Sunset", sunsetDate);
    }

    if (versionInfo.recommendation) {
      response.headers.set(
        "Deprecated-By",
        versionInfo.recommendation
      );
    }
  }

  return response;
}

/**
 * Check if a version is supported
 */
export function isVersionSupported(version: ApiVersion): boolean {
  return version in API_VERSIONS;
}

/**
 * Get version info
 */
export function getVersionInfo(version: ApiVersion): ApiVersionInfo | null {
  return API_VERSIONS[version] || null;
}

/**
 * Deprecate an API version (mark for sunset)
 * Enforces minimum 6-month deprecation window
 */
export function deprecateVersion(
  version: ApiVersion,
  recommendation?: string
): void {
  const versionInfo = API_VERSIONS[version];
  if (!versionInfo) {
    throw new Error(`Unknown API version: ${version}`);
  }

  const now = new Date();
  const sunsetDate = new Date(now.getTime() + MINIMUM_DEPRECATION_WINDOW_MS);

  versionInfo.status = "deprecated";
  versionInfo.deprecatedAt = now;
  versionInfo.sunsetAt = sunsetDate;
  versionInfo.recommendation = recommendation;
}

/**
 * Sunset an API version (make unavailable)
 * Only callable after deprecation window has passed
 */
export function sunsetVersion(version: ApiVersion): void {
  const versionInfo = API_VERSIONS[version];
  if (!versionInfo) {
    throw new Error(`Unknown API version: ${version}`);
  }

  if (versionInfo.status !== "deprecated") {
    throw new Error(
      `Version ${version} must be deprecated before sunset`
    );
  }

  if (versionInfo.sunsetAt && new Date() < versionInfo.sunsetAt) {
    throw new Error(
      `Minimum deprecation window not met. Sunset date: ${versionInfo.sunsetAt.toISOString()}`
    );
  }

  versionInfo.status = "sunset";
}

/**
 * Public versioning policy documentation
 */
export const VERSIONING_POLICY = {
  title: "CarbonSite API Versioning Policy",
  minDeprecationWindow: "6 months",
  supportedVersions: Object.keys(API_VERSIONS),
  guidelines: [
    "New versions introduced only for breaking changes",
    "Minimum 6-month notice before version sunset",
    "Deprecation headers included in responses",
    "Accept-Version header for version negotiation",
    "Default to latest stable version if not specified",
  ],
  contact: "api-support@carbonsite.io",
};
