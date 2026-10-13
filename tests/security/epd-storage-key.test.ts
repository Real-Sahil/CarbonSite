// @vitest-environment node
/** An EPD submission may attach only a file stored under its own organisation's keys. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: { epdRecord: { create: vi.fn() } },
}));
vi.mock("@/lib/db", () => ({ prisma: db.prisma }));
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
const session = vi.hoisted(() => ({
  requireOrgMember: vi.fn(),
  ROLE_GROUPS: { editor: ["admin"] },
}));
vi.mock("@/lib/auth/session", () => session);

import { POST } from "@/app/api/orgs/[orgId]/supplier-portal/epds/route";

const body = { productName: "Concrete C32/40", gwpA1A3: 120 };
const call = (b: unknown) =>
  POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(b) }), {
    params: Promise.resolve({ orgId: "org-a" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "supplier" } });
  db.prisma.epdRecord.create.mockResolvedValue({ id: "epd1", productName: "Concrete C32/40", manufacturer: null });
});

describe("EPD submission storage key", () => {
  it("refuses a file stored under another organisation", async () => {
    expect((await call({ ...body, storageKey: "org/org-b/evidence/ev1/epd.pdf" })).status).toBe(400);
    expect(db.prisma.epdRecord.create).not.toHaveBeenCalled();
  });

  it("refuses a key that passes the prefix but is not a valid storage key", async () => {
    expect((await call({ ...body, storageKey: "org/org-a/../../user/x/dsar/epd.pdf" })).status).toBe(400);
    expect(db.prisma.epdRecord.create).not.toHaveBeenCalled();
  });

  it("keeps a file stored under the organisation's own keys", async () => {
    const res = await call({ ...body, storageKey: "org/org-a/evidence/ev1/epd.pdf" });
    expect(res.status).toBe(201);
    expect(db.prisma.epdRecord.create.mock.calls[0][0].data).toMatchObject({ storageKey: "org/org-a/evidence/ev1/epd.pdf" });
  });
});
