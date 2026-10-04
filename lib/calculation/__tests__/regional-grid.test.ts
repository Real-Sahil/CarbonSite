// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pickRegionalGrid, regionInText, regionOfFacility } from "../regional-grid";

const f = (activityType: string | null) => ({ activityType });
const au = [f("purchased_electricity_location"), f("grid_au_nsw"), f("grid_au_vic"), f("grid_au_wa"), f("grid_au_nwis"), f("grid_au_nsw_upstream")];
const ca = [f("purchased_electricity_location"), f("grid_ca_on"), f("grid_ca_qc")];

describe("regional grid factors", () => {
  it("reads a region from a name in text, never an abbreviation (\"on\" is a word)", () => {
    expect(regionInText("ca", "Toronto head office")).toBe("on");
    expect(regionInText("ca", "metered on site")).toBeNull();
    expect(regionInText("au", "Victoria depot")).toBe("vic");
  });

  it("reads a facility region as a name or an exact abbreviation", () => {
    expect(regionOfFacility("ca", "ON")).toBe("on");
    expect(regionOfFacility("au", "NSW")).toBe("nsw");
    expect(regionOfFacility("au", "Queensland")).toBe("qld");
    expect(regionOfFacility("au", "")).toBeNull();
  });

  it("uses the region the hint names, else the facility's, else the national row", () => {
    const hint = pickRegionalGrid(au, "AU", "Victoria", "NSW");
    expect(hint.kind === "matched" && hint.factor.activityType).toBe("grid_au_vic");
    const fac = pickRegionalGrid(ca, "CA", null, "QC");
    expect(fac.kind === "matched" && fac.factor.activityType).toBe("grid_ca_qc");
    const none = pickRegionalGrid(ca, "CA", null, null);
    expect(none.kind === "rest" && none.candidates.map((c) => c.activityType)).toEqual(["purchased_electricity_location"]);
  });

  it("prefers the plain grid row over its upstream twin", () => {
    const r = pickRegionalGrid(au, "AU", "NSW depot New South Wales", null);
    expect(r.kind === "matched" && r.factor.activityType).toBe("grid_au_nsw");
  });

  it("never offers another country's regional rows", () => {
    const r = pickRegionalGrid(au, "GB", "Victoria", "VIC");
    expect(r.kind).toBe("rest");
    expect(r.kind === "rest" && r.candidates.every((c) => !c.activityType?.startsWith("grid_"))).toBe(true);
  });

  it("reads Western Australia as SWIS with a warning unless NWIS is named", () => {
    const wa = pickRegionalGrid(au, "AU", null, "Western Australia");
    expect(wa.kind === "matched" && wa.factor.activityType).toBe("grid_au_wa");
    expect(wa.kind === "matched" && wa.assumed).toMatch(/SWIS/);
    const nw = pickRegionalGrid(au, "AU", "Pilbara NWIS site", null);
    expect(nw.kind === "matched" && nw.factor.activityType).toBe("grid_au_nwis");
    expect(nw.kind === "matched" && nw.assumed).toBeUndefined();
  });
});
