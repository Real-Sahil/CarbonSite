import { describe, expect, it } from "vitest";
import { referenceFingerprint } from "../reference-fingerprint";

const base = {
  categories: [{ code: "s1-stationary", id: "c1" }, { code: "s2-electricity-lb", id: "c2" }],
  facilities: [{ name: "Depot A", id: "f1" }],
  businessUnits: [{ name: "Ops", id: "b1" }],
};

describe("referenceFingerprint", () => {
  it("does not depend on row order", () => {
    const reordered = { ...base, categories: [...base.categories].reverse() };
    expect(referenceFingerprint(reordered)).toBe(referenceFingerprint(base));
  });

  it("matches codes and names case-insensitively", () => {
    const shouted = {
      categories: [{ code: "S1-STATIONARY", id: "c1" }, { code: "S2-ELECTRICITY-LB", id: "c2" }],
      facilities: [{ name: "DEPOT A", id: "f1" }],
      businessUnits: [{ name: "ops", id: "b1" }],
    };
    expect(referenceFingerprint(shouted)).toBe(referenceFingerprint(base));
  });

  it("changes when a row is added, removed or re-pointed to another id", () => {
    const original = referenceFingerprint(base);
    expect(referenceFingerprint({ ...base, facilities: [...base.facilities, { name: "Depot B", id: "f2" }] })).not.toBe(original);
    expect(referenceFingerprint({ ...base, businessUnits: [] })).not.toBe(original);
    expect(referenceFingerprint({ ...base, facilities: [{ name: "Depot A", id: "f9" }] })).not.toBe(original);
  });

  it("keeps a category and a facility with the same key apart", () => {
    const asCategory = referenceFingerprint({ categories: [{ code: "x", id: "1" }], facilities: [], businessUnits: [] });
    const asFacility = referenceFingerprint({ categories: [], facilities: [{ name: "x", id: "1" }], businessUnits: [] });
    expect(asCategory).not.toBe(asFacility);
  });
});
