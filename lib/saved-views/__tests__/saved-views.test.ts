// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  checkFilters,
  createViewBody,
  filterRefs,
  isUniqueViolation,
  mayChangeView,
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
