// @vitest-environment node
/**
 * Every API route handler must either call an auth guard or sit on the
 * allowlist below with a reason. A new route that does neither fails here, so
 * an unguarded admin or org route cannot ship by accident.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const API = join(ROOT, "app", "api");

// Calls that establish who the caller is or that verify a signed or
// shared-secret request. A handler that calls one of these is guarded.
const GUARDS = [
  "requireOrgMember",
  "requireSession",
  "requirePlatformMember",
  "requireSharedLibraryEditor",
  "isAuthorizedCronRequest",
  "validateApiKey",
  "verifyCredential",
  "verifyZapierApiKey",
  "verifyZapierWebhookSignature",
  "verifyStorageSignature",
  "handleConnectorIngest",
  "constructWebhookEvent",
  "verifySvix",
  "verifyN8nSignature",
];

// Routes that are public, token-gated or signed by design. Each entry says why.
const ALLOWLIST: Array<{ path: string; reason: string }> = [
  { path: "app/api/auth/", reason: "Better Auth and invite/SSO flows: sign-in itself, or a single-use token" },
  { path: "app/api/public/", reason: "public pages and token links (share, verify, audit pack, submission)" },
  { path: "app/api/sign/", reason: "signing link, token in the URL" },
  { path: "app/api/supplier-data/", reason: "supplier data request, token in the URL" },
  { path: "app/api/supplier-portal/", reason: "supplier portal, token in the request" },
  { path: "app/api/zapier/", reason: "Zapier, checked with verifyZapierApiKey in each handler" },
  { path: "app/api/webhooks/", reason: "provider webhooks, checked by provider signature in each handler" },
  { path: "app/api/health/", reason: "liveness probe" },
  { path: "app/api/contact/", reason: "public contact form, rate limited" },
  { path: "app/api/csp-report/", reason: "browser CSP reports, public by design" },
  { path: "app/api/versioning-policy/", reason: "public policy document" },
  { path: "app/api/_meta/", reason: "public API version metadata" },
  { path: "app/api/platform/branding/", reason: "public branding for a subdomain, non-sensitive fields only" },
  { path: "app/api/metrics/", reason: "Prometheus scrape, bearer METRICS_SECRET checked in the handler" },
];

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const HANDLER = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/;

describe("API route auth coverage", () => {
  const unguarded: string[] = [];

  for (const file of routeFiles(API)) {
    const rel = relative(ROOT, file).split("\\").join("/");
    const src = readFileSync(file, "utf8");
    if (!HANDLER.test(src)) continue;
    if (ALLOWLIST.some((a) => rel.startsWith(a.path))) continue;
    if (GUARDS.some((g) => src.includes(g))) continue;
    unguarded.push(rel);
  }

  it("finds the API routes it is checking", () => {
    expect(routeFiles(API).length).toBeGreaterThan(50);
  });

  it("every route outside the allowlist calls an auth guard", () => {
    expect(unguarded).toEqual([]);
  });

  it("the rate-limiter health route is platform-only", () => {
    const src = readFileSync(join(API, "admin", "health", "rate-limiter", "route.ts"), "utf8");
    expect(src).toContain("requirePlatformMember");
  });
});
