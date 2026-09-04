import { describe, it, expect } from "vitest";
import {
  directConsolidationFactor,
  resolveEffectiveShares,
  isEntityInBoundaryOn,
  isFacilityInBoundaryOn,
  facilityConsolidationFactor,
  explainFacilityFactor,
  type ConsolidatableEntity,
  type ConsolidatableFacility,
} from "../consolidation";

function entity(over: Partial<ConsolidatableEntity> & { id: string }): ConsolidatableEntity {
  return {
    parentId: null,
    ownershipPercent: 100,
    operationalControl: true,
    financialControl: true,
    acquiredOn: null,
    divestedOn: null,
    ...over,
  };
}

function facility(
  over: Partial<ConsolidatableFacility> & { id: string },
): ConsolidatableFacility {
  return {
    legalEntityId: null,
    operationalControl: true,
    operationalFrom: null,
    operationalTo: null,
    ...over,
  };
}

describe("directConsolidationFactor", () => {
  it("consolidates a controlled entity at 100% under operational control", () => {
    const e = entity({ id: "a", operationalControl: true, ownershipPercent: 20 });
    expect(directConsolidationFactor("operational_control", e)).toBe(1);
  });

  it("excludes an uncontrolled entity entirely under operational control", () => {
    const e = entity({ id: "a", operationalControl: false, ownershipPercent: 100 });
    expect(directConsolidationFactor("operational_control", e)).toBe(0);
  });

  it("keys off financial control under the financial control approach", () => {
    const e = entity({ id: "a", operationalControl: false, financialControl: true });
    expect(directConsolidationFactor("financial_control", e)).toBe(1);
    expect(directConsolidationFactor("operational_control", e)).toBe(0);
  });

  it("uses the equity stake under the equity share approach", () => {
    const e = entity({ id: "a", ownershipPercent: 60 });
    expect(directConsolidationFactor("equity_share", e)).toBeCloseTo(0.6, 10);
  });

  it("clamps an out-of-range stake into [0, 1]", () => {
    expect(directConsolidationFactor("equity_share", entity({ id: "a", ownershipPercent: 150 }))).toBe(1);
    expect(directConsolidationFactor("equity_share", entity({ id: "a", ownershipPercent: -5 }))).toBe(0);
  });
});

describe("resolveEffectiveShares", () => {
  it("compounds equity stakes down an ownership chain", () => {
    // Group holds 60% of Mid, which holds 50% of Low. Effective stake in Low
    // is 30%, which is the figure the GHG Protocol equity share approach uses.
    const entities = [
      entity({ id: "group", ownershipPercent: 100 }),
      entity({ id: "mid", parentId: "group", ownershipPercent: 60 }),
      entity({ id: "low", parentId: "mid", ownershipPercent: 50 }),
    ];
    const shares = resolveEffectiveShares("equity_share", entities);
    expect(shares.get("group")).toBeCloseTo(1, 10);
    expect(shares.get("mid")).toBeCloseTo(0.6, 10);
    expect(shares.get("low")).toBeCloseTo(0.3, 10);
  });

  it("does not compound under the control approaches", () => {
    // Control is binary at each level: a controlled subsidiary of a controlled
    // subsidiary is still consolidated at 100%, never at 100% x 100% of a
    // partial stake.
    const entities = [
      entity({ id: "group" }),
      entity({ id: "mid", parentId: "group", ownershipPercent: 60 }),
      entity({ id: "low", parentId: "mid", ownershipPercent: 50 }),
    ];
    const shares = resolveEffectiveShares("operational_control", entities);
    expect(shares.get("low")).toBe(1);
  });

  it("excludes a whole branch when an intermediate holder is not controlled", () => {
    const entities = [
      entity({ id: "group" }),
      entity({ id: "mid", parentId: "group", operationalControl: false }),
      entity({ id: "low", parentId: "mid", operationalControl: false }),
    ];
    const shares = resolveEffectiveShares("operational_control", entities);
    expect(shares.get("mid")).toBe(0);
    expect(shares.get("low")).toBe(0);
  });

  it("survives a cycle in the parent chain without hanging", () => {
    const entities = [
      entity({ id: "a", parentId: "b", ownershipPercent: 50 }),
      entity({ id: "b", parentId: "a", ownershipPercent: 50 }),
    ];
    const shares = resolveEffectiveShares("equity_share", entities);
    expect(shares.get("a")).toBeGreaterThanOrEqual(0);
    expect(shares.get("a")).toBeLessThanOrEqual(1);
    expect(shares.get("b")).toBeGreaterThanOrEqual(0);
  });

  it("treats an entity whose parent is outside the set as a root", () => {
    const entities = [entity({ id: "orphan", parentId: "missing", ownershipPercent: 40 })];
    const shares = resolveEffectiveShares("equity_share", entities);
    expect(shares.get("orphan")).toBeCloseTo(0.4, 10);
  });
});

describe("boundary windows", () => {
  it("excludes activity before an entity was acquired", () => {
    const e = entity({ id: "a", acquiredOn: new Date("2025-06-01") });
    expect(isEntityInBoundaryOn(e, new Date("2025-05-31"))).toBe(false);
    expect(isEntityInBoundaryOn(e, new Date("2025-06-01"))).toBe(true);
    expect(isEntityInBoundaryOn(e, new Date("2026-01-01"))).toBe(true);
  });

  it("excludes activity after an entity was divested", () => {
    const e = entity({ id: "a", divestedOn: new Date("2025-06-30") });
    expect(isEntityInBoundaryOn(e, new Date("2025-06-30"))).toBe(true);
    expect(isEntityInBoundaryOn(e, new Date("2025-07-01"))).toBe(false);
  });

  it("applies the same window logic to facilities", () => {
    const f = facility({
      id: "f",
      operationalFrom: new Date("2025-01-01"),
      operationalTo: new Date("2025-12-31"),
    });
    expect(isFacilityInBoundaryOn(f, new Date("2024-12-31"))).toBe(false);
    expect(isFacilityInBoundaryOn(f, new Date("2025-07-01"))).toBe(true);
    expect(isFacilityInBoundaryOn(f, new Date("2026-01-01"))).toBe(false);
  });
});

describe("facilityConsolidationFactor", () => {
  const entities = [
    entity({ id: "group" }),
    entity({ id: "jv", parentId: "group", ownershipPercent: 50, operationalControl: false }),
  ];

  it("treats an unassigned facility as wholly owned and directly operated", () => {
    const f = facility({ id: "f" });
    const shares = resolveEffectiveShares("equity_share", entities);
    expect(
      facilityConsolidationFactor({
        approach: "equity_share",
        facility: f,
        entities,
        effectiveShares: shares,
        activityDate: new Date("2025-07-01"),
      }),
    ).toBe(1);
  });

  it("inherits the owning entity's equity share", () => {
    const f = facility({ id: "f", legalEntityId: "jv" });
    const shares = resolveEffectiveShares("equity_share", entities);
    expect(
      facilityConsolidationFactor({
        approach: "equity_share",
        facility: f,
        entities,
        effectiveShares: shares,
        activityDate: new Date("2025-07-01"),
      }),
    ).toBeCloseTo(0.5, 10);
  });

  it("excludes a facility the group does not operate under operational control", () => {
    const f = facility({ id: "f", legalEntityId: "group", operationalControl: false });
    const shares = resolveEffectiveShares("operational_control", entities);
    expect(
      facilityConsolidationFactor({
        approach: "operational_control",
        facility: f,
        entities,
        effectiveShares: shares,
        activityDate: new Date("2025-07-01"),
      }),
    ).toBe(0);
  });

  it("returns zero for activity outside the facility's operational window", () => {
    const f = facility({ id: "f", operationalFrom: new Date("2026-01-01") });
    const shares = resolveEffectiveShares("operational_control", entities);
    expect(
      facilityConsolidationFactor({
        approach: "operational_control",
        facility: f,
        entities,
        effectiveShares: shares,
        activityDate: new Date("2025-07-01"),
      }),
    ).toBe(0);
  });

  it("returns zero for activity outside the owning entity's window", () => {
    const dated = [entity({ id: "sold", divestedOn: new Date("2025-03-31") })];
    const f = facility({ id: "f", legalEntityId: "sold" });
    const shares = resolveEffectiveShares("operational_control", dated);
    expect(
      facilityConsolidationFactor({
        approach: "operational_control",
        facility: f,
        entities: dated,
        effectiveShares: shares,
        activityDate: new Date("2025-07-01"),
      }),
    ).toBe(0);
  });
});

describe("explainFacilityFactor", () => {
  it("names the equity percentage applied", () => {
    const entities = [entity({ id: "jv", ownershipPercent: 45 })];
    const f = facility({ id: "f", legalEntityId: "jv" });
    const shares = resolveEffectiveShares("equity_share", entities);
    const text = explainFacilityFactor({
      approach: "equity_share",
      facility: f,
      entities,
      effectiveShares: shares,
      activityDate: new Date("2025-07-01"),
    });
    expect(text).toContain("45%");
    expect(text).toContain("equity share");
  });

  it("says why a facility outside its window is excluded", () => {
    const f = facility({ id: "f", operationalTo: new Date("2024-12-31") });
    const text = explainFacilityFactor({
      approach: "operational_control",
      facility: f,
      entities: [],
      effectiveShares: new Map(),
      activityDate: new Date("2025-07-01"),
    });
    expect(text).toContain("outside the facility's operational window");
  });
});
