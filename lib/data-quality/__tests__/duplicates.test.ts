// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { duplicateKey } from "../duplicates";

describe("duplicateKey", () => {
  const base = { emissionCategoryId: "c1", amount: 250, unit: "Litres", activityDate: "2025-11-14", facilityId: "f1" };

  it("matches the same line however it was typed", () => {
    expect(duplicateKey(base)).toBe(duplicateKey({ ...base, amount: "250.000000", unit: "litres ", activityDate: new Date("2025-11-14T00:00:00Z") }));
  });

  it("tells different lines apart", () => {
    expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, amount: 251 }));
    expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, facilityId: "f2" }));
    expect(duplicateKey(base)).not.toBe(duplicateKey({ ...base, supplierName: "Certas" }));
  });

  it("never matches a record without a date", () => {
    expect(duplicateKey({ ...base, activityDate: null })).toBeNull();
  });
});
