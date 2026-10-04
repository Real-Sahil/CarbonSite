import { describe, expect, it } from "vitest";
import { coreReportTypes } from "../report-form";
import { countryProfile } from "@/lib/country/profile";

describe("coreReportTypes with a country profile", () => {
  it("keeps the long-standing UK list when no recommendation is given", () => {
    expect(coreReportTypes(true)).toEqual(["ghg_protocol", "ppn_006_crp", "secr", "bid_carbon_pack"]);
    expect(coreReportTypes(false)).toEqual(["ghg_protocol", "ppn_006_crp", "secr"]);
  });

  it("leads a German organisation with CSRD reports and never invents a type", () => {
    const list = coreReportTypes(true, countryProfile("DE").recommendedReports);
    expect(list[0]).toBe("ghg_protocol");
    expect(list).toContain("csrd_esrs_e1");
    expect(list).not.toContain("ppn_006_crp");
    expect(coreReportTypes(true, ["ghg_protocol", "not_a_report"])).toEqual(["ghg_protocol"]);
  });

  it("drops the bid pack where the plan has none", () => {
    expect(coreReportTypes(false, countryProfile("GB").recommendedReports)).not.toContain("bid_carbon_pack");
  });
});
