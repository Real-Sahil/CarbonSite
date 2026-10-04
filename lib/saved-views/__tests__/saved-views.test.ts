// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  activeFilters,
  checkFilters,
  createViewBody,
  filterRefs,
  isUniqueViolation,
  mayChangeView,
  sameFilters,
  updateViewBody,
  viewHref,
} from "..";

describe("checkFilters", () => {
  it("accepts the filters a page reads and nothing else", () => {
    expect(checkFilters("dashboard", { contractId: "c1", country: "GB" })).toEqual({ filters: { contractId: "c1", country: "GB" } });
    expect(checkFilters("dashboard", { orgId: "someone-else" })).toEqual({ error: '"orgId" is not a filter on this page.' });
    expect(checkFilters("dashboard", { __proto__x: "1" } as Record<string, string>)).toHaveProperty("error");
  });

  it("wants country as a two-letter capital code", () => {
    expect(checkFilters("dashboard", { country: "gb" })).toHaveProperty("error");
    expect(checkFilters("dashboard", { country: "GBR" })).toHaveProperty("error");
    expect(checkFilters("dashboard", { country: "AE" })).toHaveProperty("filters");
  });
});

describe("filterRefs", () => {
  it("maps ids that must belong to the organisation, entity as a legal entity", () => {
    expect(filterRefs({ facilityId: "f", contractId: "c", entityId: "e", country: "GB" })).toEqual({
      facilityId: "f",
      contractId: "c",
      legalEntityId: "e",
    });
  });
});

describe("viewHref", () => {
  it("builds the page address and encodes values", () => {
    expect(viewHref("org1", "dashboard", {})).toBe("/orgs/org1/dashboard");
    expect(viewHref("org1", "dashboard", { contractId: "c 1", country: "GB" })).toBe("/orgs/org1/dashboard?contractId=c+1&country=GB");
  });
});

describe("mayChangeView", () => {
  const mine = { ownerUserId: "u1", shared: false };
  const sharedOfMine = { ownerUserId: "u1", shared: true };
  it("lets the owner change their own views", () => {
    expect(mayChangeView(mine, "u1", false)).toBe(true);
    expect(mayChangeView(sharedOfMine, "u1", false)).toBe(true);
  });
  it("lets an admin change a shared view but never someone's private one", () => {
    expect(mayChangeView(sharedOfMine, "u2", true)).toBe(true);
    expect(mayChangeView(mine, "u2", true)).toBe(false);
    expect(mayChangeView(sharedOfMine, "u2", false)).toBe(false);
  });
});

describe("request bodies", () => {
  it("trims the name, defaults to private and refuses an unknown page", () => {
    expect(createViewBody.parse({ surface: "dashboard", name: "  Q3 sites ", filters: {} })).toEqual({
      surface: "dashboard",
      name: "Q3 sites",
      filters: {},
      shared: false,
    });
    expect(() => createViewBody.parse({ surface: "admin", name: "x", filters: {} })).toThrow();
    expect(() => createViewBody.parse({ surface: "dashboard", name: "   ", filters: {} })).toThrow();
    expect(() => createViewBody.parse({ surface: "dashboard", name: "x", filters: { a: "y".repeat(65) } })).toThrow();
  });
  it("needs something to change", () => {
    expect(() => updateViewBody.parse({})).toThrow();
    expect(updateViewBody.parse({ shared: true })).toEqual({ shared: true });
  });
});

describe("isUniqueViolation", () => {
  it("recognises Prisma's unique-constraint code only", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2025" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe("activeFilters and sameFilters", () => {
  it("keeps only the page's own keys that have a value", () => {
    expect(activeFilters("dashboard", { facilityId: undefined, contractId: "c1", country: "", stray: "x" } as Record<string, string | undefined>)).toEqual({ contractId: "c1" });
  });
  it("compares filter sets whatever the key order", () => {
    expect(sameFilters({ a: "1", b: "2" }, { b: "2", a: "1" })).toBe(true);
    expect(sameFilters({ a: "1" }, { a: "2" })).toBe(false);
    expect(sameFilters({ a: "1" }, { a: "1", b: "2" })).toBe(false);
    expect(sameFilters({}, {})).toBe(true);
  });
});

describe("the records surface", () => {
  it("reads period, category, status, facility, contract and supplier", () => {
    const f = { periodId: "p1", categoryId: "c1", reviewStatus: "approved", facilityId: "f1", contractId: "k1", supplier: "acme" };
    expect(checkFilters("records", f)).toEqual({ filters: f });
    expect(checkFilters("records", { entityId: "e1" })).toHaveProperty("error");
    expect(checkFilters("dashboard", { periodId: "p1" })).toHaveProperty("error");
  });
  it("refuses a review status we do not use", () => {
    expect(checkFilters("records", { reviewStatus: "deleted" })).toEqual({ error: '"deleted" is not a value the reviewStatus filter uses.' });
    expect(checkFilters("records", { reviewStatus: "pending_info" })).toHaveProperty("filters");
  });
  it("checks the period and contract ids against the organisation", () => {
    expect(filterRefs({ periodId: "p1", contractId: "k1", facilityId: "f1" })).toEqual({
      facilityId: "f1",
      contractId: "k1",
      legalEntityId: undefined,
      reportingPeriodId: "p1",
    });
  });
});

describe("the suppliers surface", () => {
  it("reads a name search, a health band and a trend", () => {
    expect(checkFilters("suppliers", { q: "acme", health: "at_risk", trend: "declining" })).toHaveProperty("filters");
    expect(checkFilters("suppliers", { health: "fine" })).toHaveProperty("error");
    expect(checkFilters("suppliers", { trend: "up" })).toHaveProperty("error");
    expect(checkFilters("suppliers", { periodId: "p1" })).toHaveProperty("error");
  });
});

describe("the submissions surface", () => {
  it("reads status, document type, facility, contract and period", () => {
    const f = { status: "needs_info", documentType: "delivery_note", facilityId: "f1", contractId: "k1", periodId: "p1" };
    expect(checkFilters("submissions", f)).toEqual({ filters: f });
    expect(checkFilters("submissions", { status: "pending" })).toHaveProperty("error");
    expect(checkFilters("submissions", { documentType: "invoice" })).toHaveProperty("error");
    expect(checkFilters("submissions", { q: "x" })).toHaveProperty("error");
  });
});

describe("the calculations surface", () => {
  it("reads status, period and factor library, with its own status list", () => {
    expect(checkFilters("calculations", { status: "failed", periodId: "p1", factorLibraryId: "lib1" })).toHaveProperty("filters");
    expect(checkFilters("calculations", { status: "approved" })).toHaveProperty("error");
    expect(checkFilters("submissions", { status: "failed" })).toHaveProperty("error");
    expect(checkFilters("calculations", { facilityId: "f1" })).toHaveProperty("error");
  });
});

describe("dashboard slice filters", () => {
  it("accepts supplier, month range and scope", async () => {
    const { checkFilters } = await import("../index");
    expect(checkFilters("dashboard", { supplier: "Certas", from: "2026-01", to: "2026-03", scope: "1" })).toEqual({
      filters: { supplier: "Certas", from: "2026-01", to: "2026-03", scope: "1" },
    });
  });

  it("refuses a malformed month and a scope outside 1 to 3", async () => {
    const { checkFilters } = await import("../index");
    expect(checkFilters("dashboard", { from: "March" })).toHaveProperty("error");
    expect(checkFilters("dashboard", { scope: "4" })).toHaveProperty("error");
  });
});
