// @vitest-environment node
/**
 * A member of org B names org A's assurance ids in an org B URL. Each route must answer 404 and write
 * nothing; a same-org call to the link route still succeeds, so the 404s are the tenancy check.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown>;
const match = (rows: Row[], where: Row) =>
  rows.find((r) => Object.entries(where).every(([k, v]) => typeof v !== "string" || r[k] === v)) ?? null;

const links = [
  { id: "link-a", organizationId: "org-a", name: "A", revokedAt: null },
  { id: "link-b", organizationId: "org-b", name: "B", revokedAt: null },
];
const rowsA = (id: string) => [{ id, organizationId: "org-a", status: "open", engagement: { status: "open" } }];

const db = vi.hoisted(() => ({
  inventoryAuditorAccess: { findFirst: vi.fn(), update: vi.fn() },
  assuranceEngagement: { findFirst: vi.fn() },
  assuranceSample: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  assuranceFinding: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  ROLE_GROUPS: {},
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "user-b" } } })),
}));

import { DELETE as revokeLink } from "@/app/api/orgs/[orgId]/assurance/auditor-links/[id]/route";
import { PATCH as testSample } from "@/app/api/orgs/[orgId]/assurance/samples/[sampleId]/route";
import { PATCH as respond, POST as resolve } from "@/app/api/orgs/[orgId]/assurance/findings/[findingId]/route";
import { POST as raiseFinding } from "@/app/api/orgs/[orgId]/assurance/engagements/[engagementId]/findings/route";

const req = (method: string) => new NextRequest("http://localhost/x", { method, body: JSON.stringify({}) });
const ctx = (params: Row) => ({ params: Promise.resolve({ orgId: "org-b", ...params }) });

const writes = () =>
  [
    db.inventoryAuditorAccess.update,
    db.assuranceSample.update,
    db.assuranceFinding.update,
    db.assuranceFinding.create,
  ].some((f) => f.mock.calls.length > 0);

beforeEach(() => {
  vi.clearAllMocks();
  db.inventoryAuditorAccess.findFirst.mockImplementation(async ({ where }) => match(links, where));
  db.assuranceSample.findFirst.mockImplementation(async ({ where }) => match(rowsA("sample-a"), where));
  db.assuranceFinding.findFirst.mockImplementation(async ({ where }) => match(rowsA("finding-a"), where));
  db.assuranceEngagement.findFirst.mockImplementation(async ({ where }) => match(rowsA("eng-a"), where));
});

describe("org B cannot reach org A's assurance records", () => {
  it.each([
    ["auditor link DELETE", () => revokeLink(req("DELETE"), ctx({ id: "link-a" }))],
    ["sample PATCH", () => testSample(req("PATCH"), ctx({ sampleId: "sample-a" }))],
    ["finding PATCH", () => respond(req("PATCH"), ctx({ findingId: "finding-a" }))],
    ["finding POST", () => resolve(req("POST"), ctx({ findingId: "finding-a" }))],
    ["engagement findings POST", () => raiseFinding(req("POST"), ctx({ engagementId: "eng-a" }))],
  ])("%s answers 404 and writes nothing", async (_name, call) => {
    expect((await call()).status).toBe(404);
    expect(writes()).toBe(false);
  });

  it("same-org link revoke still works", async () => {
    expect((await revokeLink(req("DELETE"), ctx({ id: "link-b" }))).status).toBe(204);
    expect(db.inventoryAuditorAccess.update).toHaveBeenCalledTimes(1);
  });
});
