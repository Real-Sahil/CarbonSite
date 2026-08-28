/**
 * Versioned Route Handler Wrapper
 *
 * Simplifies API version handling in route handlers:
 * - Negotiates version from Accept-Version header
 * - Adds version headers to response
 * - Enforces supported version checks
 * - Handles deprecated version warnings
 *
 * Usage:
 *   const { version, req, json, error } = await withApiVersion(request);
 *   if (!version) return error(406, "Unsupported API version");
 *   // ... handle request with version context
 *   return json({ data }, { version });
 */

import { NextRequest, NextResponse } from "next/server";
import {
  negotiateApiVersion,
  addVersionHeaders,
  getVersionInfo,
  type ApiVersion,
} from "./versioning";

export interface VersionedContext {
  version: ApiVersion;
  req: NextRequest;
  json: (data: unknown, opts?: { status?: number; version?: ApiVersion }) => NextResponse;
  error: (status: number, message: string) => NextResponse;
}

/**
 * Wrap a route handler with version negotiation and response headers.
 *
 * @param request - NextRequest
 * @returns VersionedContext with helper functions
 */
export async function withApiVersion(request: NextRequest): Promise<VersionedContext> {
  const version = negotiateApiVersion(request);

  const json = (
    data: unknown,
    opts?: { status?: number; version?: ApiVersion }
  ): NextResponse => {
    const response = NextResponse.json(data, { status: opts?.status ?? 200 });
    return addVersionHeaders(response, opts?.version ?? version);
  };

  const error = (status: number, message: string): NextResponse => {
    const response = NextResponse.json(
      { code: "API_ERROR", message },
      { status }
    );
    return addVersionHeaders(response, version);
  };

  return { version, req: request, json, error };
}

/**
 * Check if a version requires deprecation notice.
 * Returns deprecation warning if applicable.
 */
export function checkDeprecationWarning(version: ApiVersion): string | null {
  const info = getVersionInfo(version);
  if (!info) return null;

  if (info.status === "deprecated" && info.sunsetAt) {
    const sunsetDate = info.sunsetAt.toLocaleDateString();
    const recommendation = info.recommendation ? ` Migrate to ${info.recommendation}.` : "";
    return `API version ${version} is deprecated and will sunset on ${sunsetDate}.${recommendation}`;
  }

  return null;
}

/**
 * Get supported versions for error messages.
 */
export function getSupportedVersionsList(): string {
  const { API_VERSIONS } = require("./versioning");
  return Object.keys(API_VERSIONS).join(", ");
}
