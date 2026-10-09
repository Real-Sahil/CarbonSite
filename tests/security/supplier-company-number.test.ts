// @vitest-environment node
/** Saving a supplier with a picked company: the server reads the company itself, one row per company, org-scoped. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  prisma: { svSupplierLocation: { findFirst: vi.fn(), update: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);
vi.mock("@/lib/db/audit", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/billing/limits", () => ({ requireFeature: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/security/rate-limit-async", () => ({ rateLimitRequest: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/social-value/geocode", () => ({ geocodePostcodes: vi.fn(async () => new Map([["B37 7ES", { latitude: 52.4, longitude: -1.7 }]])) }));
const ch = vi.hoisted(() => ({ getCompany: vi.fn() }));
vi.mock("@/lib/geo/companies-house", async (orig) => ({ ...(await orig<typeof import("@/lib/geo/companies-house")>()), getCompany: ch.getCompany }));
const session = vi.hoisted(() => ({ requireOrgMember: vi.fn(), AuthError: class AuthError extends Error {}, ROLE_GROUPS: { dataReaders: ["admin"] } }));
vi.mock("@/lib/auth/session", () => session);

import { POST } from "@/app/api/orgs/[orgId]/sv/local-spend/suppliers/route";
import { POST as CHECK } from "@/app/api/orgs/[orgId]/sv/local-spend/suppliers/[supplierId]/check/route";

const company = { number: "00453791", name: "TARMAC TRADING LIMITED", status: "active", address: null, postcode: "B37 7ES", incorporated: null, sicCodes: ["08110"], accountsType: "small", accountsOverdue: false, hasInsolvencyHistory: false, hasCharges: false, jurisdiction: "england-wales" };
const post = (body: unknown) => POST(new NextRequest("http://x/api", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ orgId: "org-a" }) });

beforeEach(() => {
  vi.clearAllMocks();
  session.requireOrgMember.mockResolvedValue({ session: { user: { id: "u1" } }, membership: { role: "admin" } });
  ch.getCompany.mockResolvedValue(company);
  db.prisma.svSupplierLocation.findFirst.mockResolvedValue(null);
  db.prisma.svSupplierLocation.upsert.mockResolvedValue({ id: "s1", name: "Tarmac", postcode: "B37 7ES", sme: null });
  db.prisma.svSupplierLocation.update.mockResolvedValue({ id: "s1", name: "Tarmac", postcode: "B37 7ES", sme: null });
});

describe("save supplier with a company number", () => {
  it("takes the postcode and register facts from the register, not the request", async () => {
    const res = await post({ name: "Tarmac", companyNumber: "00453791" });
    expect(res.status).toBe(201);
    const data = db.prisma.svSupplierLocation.upsert.mock.calls[0][0].create;
    expect(data).toMatchObject({ organizationId: "org-a", postcode: "B37 7ES", companyNumber: "00453791" });
    expect(data.companyCheck.sicCodes).toEqual(["08110"]);
  });
  it("joins an existing row for the same company under a new spelling", async () => {
    db.prisma.svSupplierLocation.findFirst.mockResolvedValue({ id: "s1", nameKey: "tarmac", aliasKeys: [] });
    await post({ name: "Tarmac Trading", companyNumber: "00453791" });
    expect(db.prisma.svSupplierLocation.findFirst.mock.calls[0][0].where).toEqual({ organizationId: "org-a", companyNumber: "00453791" });
    const upd = db.prisma.svSupplierLocation.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: "s1" });
    expect(upd.data.aliasKeys).toEqual(["tarmac trading"]);
    expect(db.prisma.svSupplierLocation.upsert).not.toHaveBeenCalled();
  });
  it("asks for a postcode when the register is down and none was typed", async () => {
    ch.getCompany.mockRejectedValue(Object.assign(new Error("x"), { name: "Error" }));
    const { CompaniesHouseUnavailable } = await import("@/lib/geo/companies-house");
    ch.getCompany.mockRejectedValue(new CompaniesHouseUnavailable("unreachable"));
    expect((await post({ name: "Tarmac", companyNumber: "00453791" })).status).toBe(422);
  });
  it("rejects a malformed company number", async () => {
    expect((await post({ name: "Tarmac", postcode: "B37 7ES", companyNumber: "../x" })).status).toBe(422);
  });
});

describe("re-check a supplier", () => {
  const check = (id: string) => CHECK(new NextRequest("http://x/api", { method: "POST" }), { params: Promise.resolve({ orgId: "org-a", supplierId: id }) });
  it("finds the supplier only inside the organisation", async () => {
    db.prisma.svSupplierLocation.findFirst.mockResolvedValue(null);
    expect((await check("other-org-supplier")).status).toBe(404);
    expect(db.prisma.svSupplierLocation.findFirst.mock.calls[0][0].where).toEqual({ id: "other-org-supplier", organizationId: "org-a" });
  });
  it("needs a picked company", async () => {
    db.prisma.svSupplierLocation.findFirst.mockResolvedValue({ id: "s1", companyNumber: null });
    expect((await check("s1")).status).toBe(422);
  });
  it("stores the fresh facts, scoped to the organisation", async () => {
    db.prisma.svSupplierLocation.findFirst.mockResolvedValue({ id: "s1", companyNumber: "00453791" });
    ch.getCompany.mockResolvedValue({ ...company, status: "dissolved" });
    const res = await check("s1");
    expect(res.status).toBe(200);
    expect(db.prisma.svSupplierLocation.updateMany.mock.calls[0][0].where).toEqual({ id: "s1", organizationId: "org-a" });
    expect((await res.json()).companyCheck.flags[0].level).toBe("red");
  });
});
