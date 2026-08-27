import { NextRequest, NextResponse } from "next/server";

export interface ApiVersionContext {
  version: string;
  major: number;
  minor: number;
  deprecated?: boolean;
  sunsetDate?: Date;
  deprecationNotice?: string;
}

const API_VERSIONS = {
  "1.0": { major: 1, minor: 0, deprecated: false },
  "2.0": { major: 2, minor: 0, deprecated: false },
} as const;

const CURRENT_VERSION = "1.0";
const SUPPORTED_VERSIONS = Object.keys(API_VERSIONS) as Array<keyof typeof API_VERSIONS>;

// Map to store version context by request ID
const versionContextMap = new WeakMap<NextRequest, ApiVersionContext>();

/**
 * Parse Accept-Version header and return version context.
 * Supports: Accept-Version: 1.0 or Accept-Version: 2.0
 * Falls back to current version if not specified.
 */
export function parseApiVersion(req: NextRequest): ApiVersionContext {
  const acceptVersion = req.headers.get("accept-version");
  const requestedVersion = acceptVersion || CURRENT_VERSION;

  if (!SUPPORTED_VERSIONS.includes(requestedVersion as keyof typeof API_VERSIONS)) {
    throw new Error(
      `Unsupported API version: ${requestedVersion}. Supported versions: ${SUPPORTED_VERSIONS.join(", ")}`
    );
  }

  const versionSpec = API_VERSIONS[requestedVersion as keyof typeof API_VERSIONS];

  return {
    version: requestedVersion,
    major: versionSpec.major,
    minor: versionSpec.minor,
    deprecated: versionSpec.deprecated,
  };
}

type RouteHandler = (request: NextRequest, ...args: unknown[]) => Promise<NextResponse | Response>;

/**
 * Middleware wrapper for versioned API routes.
 * Enforces Accept-Version header and adds version info to response headers.
 */
export function withApiVersion(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, ...args: unknown[]): Promise<NextResponse | Response> => {
    try {
      const versionContext = parseApiVersion(request);

      // Store version info in WeakMap for later retrieval
      versionContextMap.set(request, versionContext);

      const response = await handler(request, ...args);

      // Add version headers to response
      if (response instanceof NextResponse) {
        response.headers.set("API-Version", versionContext.version);

        if (versionContext.deprecated) {
          response.headers.set("Deprecation", "true");
          if (versionContext.sunsetDate) {
            response.headers.set(
              "Sunset",
              versionContext.sunsetDate.toISOString()
            );
          }
          if (versionContext.deprecationNotice) {
            response.headers.set("Warning", `299 - "${versionContext.deprecationNotice}"`);
          }
        }
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unsupported API version")) {
        return NextResponse.json(
          {
            code: "UNSUPPORTED_API_VERSION",
            message: error.message,
            supportedVersions: SUPPORTED_VERSIONS,
          },
          { status: 406 }
        );
      }
      throw error;
    }
  };
}

/**
 * Get API version from request context.
 * Usage: const version = getApiVersionFromRequest(request);
 */
export function getApiVersionFromRequest(request: NextRequest): ApiVersionContext | null {
  return versionContextMap.get(request) || null;
}

/**
 * Check if API version is deprecated.
 */
export function isVersionDeprecated(version: string): boolean {
  const spec = API_VERSIONS[version as keyof typeof API_VERSIONS];
  return spec?.deprecated || false;
}

/**
 * Get current/latest supported API version.
 */
export function getCurrentApiVersion(): string {
  return CURRENT_VERSION;
}

/**
 * Get all supported API versions.
 */
export function getSupportedApiVersions(): string[] {
  return SUPPORTED_VERSIONS;
}
