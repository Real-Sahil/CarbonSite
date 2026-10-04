import { describe, expect, it } from "vitest";
import { suggestSubregion, distanceKm, type PlantData } from "../egrid-locate";

const real = (lat: number, lon: number) => suggestSubregion(lat, lon);

describe("eGRID subregion suggestion", () => {
  it("places well-known cities in their subregion, from the shipped eGRID2023 plants", () => {
    expect(real(34.05, -118.24)).toMatchObject({ kind: "suggested", code: "CAMX" }); // Los Angeles
    expect(real(30.27, -97.74)).toMatchObject({ kind: "suggested", code: "ERCT" }); // Austin
    expect(real(42.36, -71.06)).toMatchObject({ kind: "suggested", code: "NEWE" }); // Boston
    expect(real(25.76, -80.19)).toMatchObject({ kind: "suggested", code: "FRCC" }); // Miami
  });

  it("suggests nothing far from any US plant or for a bad position", () => {
    expect(real(51.5, -0.12)).toEqual({ kind: "none" }); // London
    expect(real(NaN, 0)).toEqual({ kind: "none" });
    expect(real(95, 0)).toEqual({ kind: "none" });
  });

  it("will not pick a side where the nearest plants disagree", () => {
    const d: PlantData = { subs: ["AAAA", "BBBB"], plants: [[40, -100, 0], [40.01, -100, 0], [40.02, -100, 0], [40, -100.01, 1], [40.01, -100.01, 1], [40.02, -100.01, 1]] };
    expect(suggestSubregion(40.01, -100.005, d)).toMatchObject({ kind: "unsure", candidates: ["AAAA", "BBBB"] });
    const s = suggestSubregion(40.01, -99.9, d);
    expect(s.kind).toBe("unsure");
  });

  it("measures distance on a sphere", () => {
    expect(Math.round(distanceKm(0, 0, 0, 1))).toBe(111);
    expect(distanceKm(10, 10, 10, 10)).toBe(0);
  });
});
