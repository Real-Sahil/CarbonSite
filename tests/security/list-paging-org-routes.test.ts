// @vitest-environment node
/**
 * The org lists that moved from a bare array to `{ data, pagination }`. Each one must page with
 * clamped limit/offset, count with the same `where` it reads with, keep the organisation in the
 * URL, and report the page. A bare array here would silently break the pickers still reading it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const MODELS = [
  "organizationMembership",
  "site",
  "facility",
  "inviteLink",
  "supplierInvite",
  "supplierDataRequest",
  "socialValueRecord",
  "fieldWorkerAssignment",
  "fieldWorkerSiteAssignment",
] as const;

const db = vi.hoisted(() => ({
  prisma: {} as Record<string, { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> }>,
}));
vi.hoisted(() => {
  for (const name of [
    "organizationMembership",
    "site",
    "facility",
    "inviteLink",
    "supplierInvite",
    "supplierDataRequest",
    "socialValueRecord",
    "fieldWorkerAssignment",
    "fieldWorkerSiteAssignment",
  ]) {
    db.prisma[name] = { findMany: vi.fn(), count: vi.fn() };
  }
});

vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireOrgMember: vi.fn(async () => ({ session: { user: { id: "u1" } }, membership: { role: "admin" } })),
  // Any role group a route names resolves to an empty list; the mocked session accepts every role.
  ROLE_GROUPS: new Proxy({}, { get: () => [] }),
  AuthError: class AuthError extends Error {},
}));
vi.mock("@/lib/billing/limits", () => ({ requireCapacity: vi.fn(async () => null), requireFeature: vi.fn(async () => null) }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn(async () => null) }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimitKey: vi.fn(() => "key") }));
vi.mock("@/lib/notifications/email", () => ({
  sendEmail: vi.fn(),
  memberAccessGrantedEmail: vi.fn(),
  memberInviteEmail: vi.fn(),
  fieldWorkerInviteEmail: vi.fn(),
  resolveEmailLogoUrl: vi.fn(),
}));
vi.mock("@/lib/jobs/dispatch", () => ({ dispatchNotification: vi.fn() }));
vi.mock("@/lib/auth/temporary-password", () => ({ generateTemporaryPassword: vi.fn(), hashTemporaryPassword: vi.fn() }));

import { GET as getMembers } from "@/app/api/orgs/[orgId]/members/route";
import { GET as getSites } from "@/app/api/orgs/[orgId]/sites/route";
import { GET as getFacilities } from "@/app/api/orgs/[orgId]/facilities/route";
import { GET as getInviteLinks } from "@/app/api/orgs/[orgId]/invite-links/route";
import { GET as getSupplierInvites } from "@/app/api/orgs/[orgId]/supplier-invites/route";
import { GET as getSupplierRequests } from "@/app/api/orgs/[orgId]/supplier-data-requests/route";
import { GET as getSocialValueRecords } from "@/app/api/orgs/[orgId]/social-value/records/route";
import { GET as getFieldWorkerAssignments } from "@/app/api/orgs/[orgId]/field-worker-assignments/route";
import { GET as getFieldWorkerSiteAssignments } from "@/app/api/orgs/[orgId]/field-worker-site-assignments/route";

const ctx = { params: Promise.resolve({ orgId: "org-a" }) };

type Route = {
  name: string;
  model: (typeof MODELS)[number];
  handler: (req: NextRequest, ctx: { params: Promise<{ orgId: string }> }) => Promise<Response>;
  path: string;
};

const routes: Route[] = [
  { name: "members", model: "organizationMembership", handler: getMembers, path: "members" },
  { name: "sites", model: "site", handler: getSites, path: "sites" },
  { name: "facilities", model: "facility", handler: getFacilities, path: "facilities" },
  { name: "invite-links", model: "inviteLink", handler: getInviteLinks, path: "invite-links" },
  { name: "supplier-invites", model: "supplierInvite", handler: getSupplierInvites, path: "supplier-invites" },
  { name: "supplier-data-requests", model: "supplierDataRequest", handler: getSupplierRequests, path: "supplier-data-requests" },
  { name: "social-value/records", model: "socialValueRecord", handler: getSocialValueRecords, path: "social-value/records" },
  { name: "field-worker-assignments", model: "fieldWorkerAssignment", handler: getFieldWorkerAssignments, path: "field-worker-assignments" },
  {
    name: "field-worker-site-assignments",
    model: "fieldWorkerSiteAssignment",
    handler: getFieldWorkerSiteAssignments,
    path: "field-worker-site-assignments",
  },
];

// The supplier routes map dates and nested relations, so they need the fields they read.
const SUPPLIER_INVITE_ROW = {
  id: "row-1",
  email: "s@example.com",
  companyName: "Supplier Ltd",
  expiresAt: new Date("2030-01-01T00:00:00Z"),
  usedAt: null,
  createdAt: new Date("2029-12-01T00:00:00Z"),
  inviteMethod: "email",
  createdBy: { name: "Admin", email: "a@example.com" },
};
const SUPPLIER_REQUEST_ROW = {
  id: "row-1",
  supplierEmail: "s@example.com",
  supplierName: "Supplier Ltd",
  categoryCode: "s3-purchased-goods",
  status: "sent",
  sentAt: new Date("2029-12-01T00:00:00Z"),
  openedAt: null,
  submittedAt: null,
  expiresAt: new Date("2030-01-01T00:00:00Z"),
  reportingPeriod: { label: "FY2029" },
  createdBy: { name: "Admin", email: "a@example.com" },
};
const DEFAULT_ROWS: Partial<Record<(typeof MODELS)[number], unknown>> = {
  supplierInvite: SUPPLIER_INVITE_ROW,
  supplierDataRequest: SUPPLIER_REQUEST_ROW,
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const name of MODELS) {
    db.prisma[name].findMany.mockResolvedValue([DEFAULT_ROWS[name] ?? { id: "row-1" }]);
    db.prisma[name].count.mockResolvedValue(3);
  }
});

describe.each(routes)("GET /$name returns a page, not a bare array", (route) => {
  const get = (qs: string) =>
    route.handler(new NextRequest(`http://x/api/orgs/org-a/${route.path}${qs}`), ctx);

  it("reports data and pagination with the default page", async () => {
    const res = await get("");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(false);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("row-1");
    expect(body.pagination).toEqual({ offset: 0, limit: 50, total: 3 });
  });

  it("pages with take/skip and counts with the same where", async () => {
    await get("?limit=20&offset=40");
    const args = db.prisma[route.model].findMany.mock.calls[0][0];
    expect(args.take).toBe(20);
    expect(args.skip).toBe(40);
    expect(db.prisma[route.model].count.mock.calls[0][0].where).toEqual(args.where);
  });

  it("clamps a runaway limit and offset and never passes NaN", async () => {
    await get("?limit=100000&offset=999999999");
    const args = db.prisma[route.model].findMany.mock.calls[0][0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(100_000);

    await get("?limit=abc&offset=-3");
    const fallback = db.prisma[route.model].findMany.mock.calls[1][0];
    expect(fallback.take).toBe(50);
    expect(fallback.skip).toBe(0);
  });

  it("orders with an id tie-breaker so offsets stay stable between pages", async () => {
    await get("");
    const { orderBy } = db.prisma[route.model].findMany.mock.calls[0][0];
    expect(JSON.stringify(orderBy)).toContain('"id"');
  });
});

describe("organisation scope and filters on the migrated lists", () => {
  it("members and sites read only the organisation in the URL", async () => {
    await getMembers(new NextRequest("http://x/api/orgs/org-a/members?organizationId=org-b"), ctx);
    expect(db.prisma.organizationMembership.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });

    await getSites(new NextRequest("http://x/api/orgs/org-a/sites"), ctx);
    expect(db.prisma.site.findMany.mock.calls[0][0].where).toEqual({ organizationId: "org-a" });
  });

  it("invite links keep the field-worker, unexpired-or-reusable filter", async () => {
    await getInviteLinks(new NextRequest("http://x/api/orgs/org-a/invite-links"), ctx);
    const where = db.prisma.inviteLink.findMany.mock.calls[0][0].where;
    expect(where.organizationId).toBe("org-a");
    expect(where.role).toBe("field_worker");
    expect(where.OR).toHaveLength(2);
  });

  it("supplier data requests keep the reporting-period filter", async () => {
    await getSupplierRequests(new NextRequest("http://x/api/orgs/org-a/supplier-data-requests?reportingPeriodId=p1"), ctx);
    expect(db.prisma.supplierDataRequest.findMany.mock.calls[0][0].where).toEqual({
      organizationId: "org-a",
      reportingPeriodId: "p1",
    });
  });

  it("social value records keep the contract and period filters", async () => {
    await getSocialValueRecords(
      new NextRequest("http://x/api/orgs/org-a/social-value/records?contractId=c1&reportingPeriodId=p2"),
      ctx,
    );
    const where = db.prisma.socialValueRecord.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ organizationId: "org-a", contractId: "c1", reportingPeriodId: "p2" });
  });
});
