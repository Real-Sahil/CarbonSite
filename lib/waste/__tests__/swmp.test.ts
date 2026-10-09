import { describe, expect, it } from "vitest";
import { compareToForecast, swmpChecks, wastePlanSchema } from "../swmp";

const lines = [
  { wasteType: "Mixed C&D", ewcCode: "17 09 04", forecastTonnes: 100, plannedRoute: "recycle" as const },
  { wasteType: "Plasterboard", ewcCode: null, forecastTonnes: 20, plannedRoute: "landfill" as const },
];

describe("swmpChecks", () => {
  it("lists what is missing and passes a complete plan", () => {
    const empty = swmpChecks({ lines: [] });
    expect(empty.filter((c) => !c.ok).map((c) => c.key)).toEqual(["person", "contractor", "forecast", "target", "actions", "review"]);
    const full = swmpChecks({ responsiblePerson: "A Smith", principalContractor: "Sisk", targetDiversionPct: 95, actions: "Segregate", nextReviewOn: "2026-12-01", lines });
    expect(full.every((c) => c.ok)).toBe(true);
  });
  it("flags an EWC code that is not on the List of Waste", () => {
    const c = swmpChecks({ lines: [{ ...lines[0], ewcCode: "99 99 99" }] }).find((x) => x.key === "ewc")!;
    expect(c.ok).toBe(false);
  });
});

describe("compareToForecast", () => {
  it("matches by EWC code, then waste type, and keeps the rest as unplanned", () => {
    const r = compareToForecast(lines, [
      { wasteType: "Rubble", ewcCode: "170904", route: "recycling_mixed", tonnes: 80 },
      { wasteType: "plasterboard", ewcCode: null, route: "landfill_mixed", tonnes: 30 },
      { wasteType: "Timber", ewcCode: null, route: "recycling_mixed", tonnes: 5 },
    ]);
    expect(r.rows[0]).toMatchObject({ actualTonnes: 80, varianceTonnes: -20 });
    expect(r.rows[1]).toMatchObject({ actualTonnes: 30, varianceTonnes: 10 });
    expect(r.unplannedTonnes).toBe(5);
    expect(r.actualTotal).toBe(115);
    expect(r.plannedDiversionPct).toBeCloseTo((100 / 120) * 100);
    expect(r.actualDiversionPct).toBeCloseTo((85 / 115) * 100);
  });
  it("gives no percentages without waste", () => {
    const r = compareToForecast([], []);
    expect(r.plannedDiversionPct).toBeNull();
    expect(r.actualDiversionPct).toBeNull();
  });
});

describe("wastePlanSchema", () => {
  it("refuses unknown fields and bad routes", () => {
    expect(wastePlanSchema.safeParse({ lines: [], status: "approved" }).success).toBe(false);
    expect(wastePlanSchema.safeParse({ lines: [{ wasteType: "x", forecastTonnes: 1, plannedRoute: "burn" }] }).success).toBe(false);
  });
});

import { siteScope } from "@/lib/project/scope";
describe("siteScope", () => {
  it("prefers a chosen site, then the project's sites, else no restriction", () => {
    expect(siteScope("s1", ["s1", "s2"])).toEqual({ siteId: "s1" });
    expect(siteScope(null, ["s1", "s2"])).toEqual({ siteId: { in: ["s1", "s2"] } });
    expect(siteScope(null, [])).toEqual({ siteId: { in: [] } });
    expect(siteScope(null, null)).toEqual({});
  });
});
