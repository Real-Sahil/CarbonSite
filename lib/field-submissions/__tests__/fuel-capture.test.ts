import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  prisma: { fuelStore: { findFirst: vi.fn() }, plantAsset: { findFirst: vi.fn() } },
}));
vi.mock("@/lib/db", () => db);

import { fuelLogEntry, fuelSubmissionError, approveFuelInTx } from "../fuel-capture";

const issue = { action: "issue", storeId: "s1", on: "2026-09-12", litres: "120.5", plantAssetId: "a1" };

beforeEach(() => vi.clearAllMocks());

describe("fuelLogEntry", () => {
  it("reads an issue, a delivery and a dip", () => {
    expect(fuelLogEntry(issue)).toMatchObject({ entry: { action: "issue", litres: 120.5, plantAssetId: "a1" } });
    expect(fuelLogEntry({ action: "delivery", storeId: "s1", on: "2026-09-01", litres: 3000, fuelType: "HVO" })).toMatchObject({ entry: { fuelType: "HVO" } });
    expect(fuelLogEntry({ action: "dip", storeId: "s1", on: "2026-09-01", litres: 0 })).toMatchObject({ entry: { litres: 0 } });
  });
  it("refuses incomplete or impossible entries", () => {
    for (const bad of [
      { ...issue, action: "burn" }, { ...issue, storeId: "" }, { ...issue, litres: 0 }, { ...issue, litres: -5 },
      { ...issue, on: "12/09/2026" }, { ...issue, plantAssetId: undefined },
      { action: "delivery", storeId: "s1", on: "2026-09-01", litres: 10 }, { action: "dip", storeId: "s1", on: "2026-09-01", litres: -1 },
    ]) expect("error" in fuelLogEntry(bad)).toBe(true);
  });
});

describe("fuelSubmissionError", () => {
  it("needs a site, a store on that site, and the org's machine", async () => {
    expect(await fuelSubmissionError("o", null, issue)).toMatch(/site/);
    db.prisma.fuelStore.findFirst.mockResolvedValue(null);
    expect(await fuelSubmissionError("o", "site1", issue)).toMatch(/not on this site/);
    expect(db.prisma.fuelStore.findFirst.mock.calls[0][0].where).toEqual({ id: "s1", organizationId: "o" });
    db.prisma.fuelStore.findFirst.mockResolvedValue({ siteId: "other", active: true });
    expect(await fuelSubmissionError("o", "site1", issue)).toMatch(/not on this site/);
    db.prisma.fuelStore.findFirst.mockResolvedValue({ siteId: "site1", active: true });
    db.prisma.plantAsset.findFirst.mockResolvedValue(null);
    expect(await fuelSubmissionError("o", "site1", issue)).toMatch(/machine/);
    expect(db.prisma.plantAsset.findFirst.mock.calls[0][0].where).toEqual({ id: "a1", organizationId: "o" });
    db.prisma.plantAsset.findFirst.mockResolvedValue({ id: "a1" });
    expect(await fuelSubmissionError("o", "site1", issue)).toBeNull();
  });
  it("refuses a retired store", async () => {
    db.prisma.fuelStore.findFirst.mockResolvedValue({ siteId: "site1", active: false });
    expect(await fuelSubmissionError("o", "site1", { ...issue, plantAssetId: undefined, vehicleLabel: "Van" })).toMatch(/retired/);
  });
});

describe("approveFuelInTx", () => {
  it("is idempotent: a second approval returns the first entry", async () => {
    const tx = {
      fuelStore: { findFirst: vi.fn().mockResolvedValue({ id: "s1" }) },
      plantAsset: { findFirst: vi.fn().mockResolvedValue({ id: "a1" }) },
      fuelIssue: { findFirst: vi.fn().mockResolvedValue({ id: "existing" }), create: vi.fn() },
    };
    const r = await approveFuelInTx(tx as never, { orgId: "o", submission: { id: "sub1", formData: issue, submittedByUserId: "u" } });
    expect(r).toMatchObject({ fuelEntryId: "existing", kind: "issue", litres: 120.5 });
    expect(tx.fuelIssue.create).not.toHaveBeenCalled();
  });
});

import { NO_CATEGORY_TYPES } from "../safety-capture";
describe("review route", () => {
  it("does not ask a fuel log for an emission category", () => {
    expect(NO_CATEGORY_TYPES.has("fuel_log")).toBe(true);
  });
});
