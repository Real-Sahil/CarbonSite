// @vitest-environment node
/**
 * Every route under app/api/orgs/[orgId] must name an authentication guard, so a new route cannot ship open by
 * forgetting one. This is a file-level source check: it proves a guard is referenced, not that each handler calls
 * it on every path. The cross-tenant tests in this folder cover behaviour.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(process.cwd(), "app", "api", "orgs", "[orgId]");

// Session or role guards.
const SESSION_GUARDS = ["requireOrgMember", "requireOrgAdmin", "requireSession", "requireProjectAccess", "requireSharedLibraryEditor", "requirePlatformMember"];
// Routes called by machines: an org API key, a signed webhook, or a device credential.
const MACHINE_GUARDS = ["validateApiKey", "handleConnectorIngest", "verifyZapierWebhookSignature", "verifyCredential"];

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === "route.ts" ? [full] : [];
  });
}

function namesGuard(source: string): boolean {
  return [...SESSION_GUARDS, ...MACHINE_GUARDS].some((guard) => new RegExp(`\\b${guard}\\b`).test(source));
}

describe("org-scoped API routes name an authentication guard", () => {
  const files = routeFiles(ROOT);

  it("finds the routes", () => {
    expect(files.length).toBeGreaterThan(300);
  });

  it("recognises a guarded and an unguarded handler", () => {
    expect(namesGuard("const m = await requireOrgMember(orgId, 'admin');")).toBe(true);
    expect(namesGuard("export async function GET() { return Response.json({}); }")).toBe(false);
  });

  it("has no route without a guard", () => {
    const open = files.filter((f) => !namesGuard(readFileSync(f, "utf8"))).map((f) => relative(process.cwd(), f));
    expect(open, `Add requireOrgMember (or an API key / signature check) to: ${open.join(", ")}`).toEqual([]);
  });
});
