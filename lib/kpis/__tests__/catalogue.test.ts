import { describe, expect, it } from "vitest";
import { KPIS, addRecord, emptyAgg, parseKpiIds, DEFAULT_KPIS } from "../catalogue";

const agg = () => {
  const a = emptyAgg();
  addRecord(a, { tonnes: 60, route: "recycling_mixed", hazardous: false, co2eT: 1 });
  addRecord(a, { tonnes: 20, route: "incineration_efw", hazardous: false, co2eT: 2 });
  addRecord(a, { tonnes: 20, route: "landfill_mixed", hazardous: true, co2eT: 4 });
  return a;
};
const kpi = (id: string) => KPIS.find((k) => k.id === id)!;

describe("KPI catalogue", () => {
  it("computes shares and totals", () => {
    const a = agg();
    expect(kpi("wt").compute(a)).toBe(100);
    expect(kpi("dv").compute(a)).toBe(80);
    expect(kpi("rc").compute(a)).toBe(60);
    expect(kpi("lf").compute(a)).toBe(20);
    expect(kpi("hz").compute(a)).toBe(20);
    expect(kpi("co").compute(a)).toBe(7);
  });
  it("needs a value or floor area for the per-unit KPIs, and says null without", () => {
    const a = agg();
    expect(kpi("pk").compute(a)).toBeNull();
    expect(kpi("pm").compute(a)).toBeNull();
    a.value = 2_000_000; a.floorM2 = 5_000;
    expect(kpi("pk").compute(a)).toBe(5);
    expect(kpi("pm").compute(a)).toBe(2);
  });
  it("gives null, not zero, for no waste", () => expect(kpi("wt").compute(emptyAgg())).toBeNull());
  it("keeps ids short enough for a saved view", () => expect(KPIS.map((k) => k.id).join(",").length).toBeLessThanOrEqual(64));
});

describe("parseKpiIds", () => {
  it("keeps known ids in catalogue order and falls back to the defaults", () => {
    expect(parseKpiIds("pk,wt,zzz")).toEqual(["wt", "pk"]);
    expect(parseKpiIds("zzz")).toEqual(DEFAULT_KPIS);
    expect(parseKpiIds(undefined)).toEqual(DEFAULT_KPIS);
  });
});
