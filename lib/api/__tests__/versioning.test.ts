import { describe, expect, test, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  negotiateApiVersion,
  addVersionHeaders,
  isVersionSupported,
  getVersionInfo,
  deprecateVersion,
  sunsetVersion,
  API_VERSIONS,
  type ApiVersion,
} from "../versioning";

describe("API Versioning Framework", () => {
  describe("negotiateApiVersion", () => {
    const makeRequest = (acceptVersion?: string): NextRequest => {
      const headers = new Headers();
      if (acceptVersion) {
        headers.set("Accept-Version", acceptVersion);
      }
      return new NextRequest("https://api.metricora.test/orgs", { headers });
    };

    test("returns Accept-Version header value when provided", () => {
      const req = makeRequest("2.0");
      expect(negotiateApiVersion(req)).toBe("2.0");
    });

    test("returns default version when Accept-Version not provided", () => {
      const req = makeRequest();
      expect(negotiateApiVersion(req)).toBe("1.0");
    });

    test("returns default version for unsupported Accept-Version", () => {
      const req = makeRequest("3.0");
      expect(negotiateApiVersion(req)).toBe("1.0");
    });

    test("handles malformed Accept-Version header gracefully", () => {
      const req = makeRequest("invalid");
      expect(negotiateApiVersion(req)).toBe("1.0");
    });

    test("prefers explicitly requested version over default", () => {
      const req = makeRequest("2.0");
      const version = negotiateApiVersion(req);
      expect(version).toBe("2.0");
      expect(version).not.toBe("1.0");
    });
  });

  describe("addVersionHeaders", () => {
    let response: NextResponse;

    beforeEach(() => {
      response = new NextResponse();
    });

    test("adds API-Version header", () => {
      const result = addVersionHeaders(response, "1.0");
      expect(result.headers.get("API-Version")).toBe("1.0");
      expect(result.headers.get("X-API-Version")).toBe("1.0");
    });

    test("adds deprecation headers when version deprecated", () => {
      // Mark v1.0 as deprecated temporarily
      const originalStatus = API_VERSIONS["1.0"].status;
      const originalDeprecatedAt = API_VERSIONS["1.0"].deprecatedAt;
      const originalSunsetAt = API_VERSIONS["1.0"].sunsetAt;
      const originalRecommendation = API_VERSIONS["1.0"].recommendation;

      API_VERSIONS["1.0"].status = "deprecated";
      API_VERSIONS["1.0"].deprecatedAt = new Date();
      API_VERSIONS["1.0"].sunsetAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000);
      API_VERSIONS["1.0"].recommendation = "2.0";

      const result = addVersionHeaders(response, "1.0");

      expect(result.headers.get("Deprecation")).toBe("true");
      expect(result.headers.get("Warning")).toContain("API version 1.0 is deprecated");
      expect(result.headers.get("Sunset")).toBeDefined();
      expect(result.headers.get("Deprecated-By")).toBe("2.0");

      // Restore original values
      API_VERSIONS["1.0"].status = originalStatus;
      API_VERSIONS["1.0"].deprecatedAt = originalDeprecatedAt;
      API_VERSIONS["1.0"].sunsetAt = originalSunsetAt;
      API_VERSIONS["1.0"].recommendation = originalRecommendation;
    });

    test("does not add deprecation headers for active versions", () => {
      const result = addVersionHeaders(response, "1.0");
      expect(result.headers.get("Deprecation")).toBeNull();
      expect(result.headers.get("Sunset")).toBeNull();
      expect(result.headers.get("Deprecated-By")).toBeNull();
    });
  });

  describe("isVersionSupported", () => {
    test("returns true for supported versions", () => {
      expect(isVersionSupported("1.0")).toBe(true);
      expect(isVersionSupported("2.0")).toBe(true);
    });

    test("returns false for unsupported versions", () => {
      expect(isVersionSupported("3.0" as ApiVersion)).toBe(false);
      expect(isVersionSupported("99.0" as ApiVersion)).toBe(false);
    });
  });

  describe("getVersionInfo", () => {
    test("returns version info for supported versions", () => {
      const info = getVersionInfo("1.0");
      expect(info).toBeDefined();
      expect(info?.version).toBe("1.0");
      expect(info?.status).toBe("active");
    });

    test("returns null for unsupported versions", () => {
      const info = getVersionInfo("3.0" as ApiVersion);
      expect(info).toBeNull();
    });
  });

  describe("deprecateVersion", () => {
    test("marks version as deprecated", () => {
      const originalStatus = API_VERSIONS["2.0"].status;
      deprecateVersion("2.0", "3.0");

      expect(API_VERSIONS["2.0"].status).toBe("deprecated");
      expect(API_VERSIONS["2.0"].deprecatedAt).toBeDefined();
      expect(API_VERSIONS["2.0"].sunsetAt).toBeDefined();
      expect(API_VERSIONS["2.0"].recommendation).toBe("3.0");

      // Restore original status
      API_VERSIONS["2.0"].status = originalStatus;
      API_VERSIONS["2.0"].deprecatedAt = undefined;
      API_VERSIONS["2.0"].sunsetAt = undefined;
      API_VERSIONS["2.0"].recommendation = undefined;
    });

    test("sets sunset date 6 months in future", () => {
      const before = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000 - 1000);
      deprecateVersion("2.0");
      const after = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000 + 1000);

      const sunsetDate = API_VERSIONS["2.0"].sunsetAt!;
      expect(sunsetDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(sunsetDate.getTime()).toBeLessThanOrEqual(after.getTime());

      // Restore original status
      API_VERSIONS["2.0"].status = "active";
      API_VERSIONS["2.0"].deprecatedAt = undefined;
      API_VERSIONS["2.0"].sunsetAt = undefined;
      API_VERSIONS["2.0"].recommendation = undefined;
    });

    test("throws error for unsupported version", () => {
      expect(() => deprecateVersion("3.0" as ApiVersion)).toThrow(
        "Unknown API version: 3.0"
      );
    });
  });

  describe("sunsetVersion", () => {
    beforeEach(() => {
      // Prepare v2.0 for sunset testing by deprecating it first
      const versionInfo = API_VERSIONS["2.0"];
      versionInfo.status = "deprecated";
      versionInfo.deprecatedAt = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
      versionInfo.sunsetAt = new Date(Date.now() - 1000); // Already past sunset date
    });

    test("marks version as sunset when deprecation window passed", () => {
      sunsetVersion("2.0");
      expect(API_VERSIONS["2.0"].status).toBe("sunset");

      // Restore original status
      API_VERSIONS["2.0"].status = "active";
      API_VERSIONS["2.0"].deprecatedAt = undefined;
      API_VERSIONS["2.0"].sunsetAt = undefined;
    });

    test("throws error when sunetting non-deprecated version", () => {
      expect(() => sunsetVersion("1.0")).toThrow(
        "Version 1.0 must be deprecated before sunset"
      );
    });

    test("throws error when deprecation window not yet passed", () => {
      const versionInfo = API_VERSIONS["2.0"];
      versionInfo.status = "deprecated";
      versionInfo.deprecatedAt = new Date();
      versionInfo.sunsetAt = new Date(Date.now() + 1000);

      expect(() => sunsetVersion("2.0")).toThrow(
        "Minimum deprecation window not met"
      );

      // Restore original status
      versionInfo.status = "active";
      versionInfo.deprecatedAt = undefined;
      versionInfo.sunsetAt = undefined;
    });
  });

  describe("versioning policy", () => {
    test("enforces 6-month minimum deprecation window", () => {
      deprecateVersion("2.0");
      const sunsetDate = API_VERSIONS["2.0"].sunsetAt!;
      const deprecatedDate = API_VERSIONS["2.0"].deprecatedAt!;
      const windowMs = sunsetDate.getTime() - deprecatedDate.getTime();

      // Should be approximately 6 months (with small variance for execution time)
      const sixMonthsMs = 6 * 30 * 24 * 60 * 60 * 1000;
      expect(windowMs).toBeGreaterThanOrEqual(sixMonthsMs - 5000);
      expect(windowMs).toBeLessThanOrEqual(sixMonthsMs + 5000);

      // Restore
      API_VERSIONS["2.0"].status = "active";
      API_VERSIONS["2.0"].deprecatedAt = undefined;
      API_VERSIONS["2.0"].sunsetAt = undefined;
      API_VERSIONS["2.0"].recommendation = undefined;
    });
  });
});
