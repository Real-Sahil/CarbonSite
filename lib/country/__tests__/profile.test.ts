import { describe, expect, it } from "vitest";
import { countryProfile } from "../profile";

describe("countryProfile", () => {
  it("leads a UK organisation with the UK forms, however the country was typed", () => {
    for (const c of ["GB", "UK", "United Kingdom", "gb"]) {
      const p = countryProfile(c);
      expect(p.iso2).toBe("GB");
      expect(p.region).toBe("uk");
      expect(p.recommendedReports.slice(0, 2)).toEqual(["ghg_protocol", "ppn_006_crp"]);
      expect(p.nationalLibraryCountry).toBe("GB");
    }
  });

  it("leads an EU organisation with CSRD reports and does not offer UK forms first", () => {
    const p = countryProfile("DE");
    expect(p.region).toBe("eu");
    expect(p.recommendedReports).toContain("csrd_esrs_e1");
    expect(p.recommendedReports).not.toContain("ppn_006_crp");
    expect(p.nationalLibraryCountry).toBe("DE");
    expect(countryProfile("FR").nationalLibraryCountry).toBe("FR");
    expect(countryProfile("IT").nationalLibraryCountry).toBeNull();
  });

  it("has a national library for Australia, Canada and Ireland", () => {
    for (const c of ["AU", "CA", "IE"]) expect(countryProfile(c).nationalLibraryCountry).toBe(c);
  });

  it("says what the UAE and US actually have loaded, and nothing more", () => {
    expect(countryProfile("AE").notes.join(" ")).toMatch(/Abu Dhabi MRV/);
    expect(countryProfile("US").nationalLibraryCountry).toBe("US");
    expect(countryProfile("US").notes.join(" ")).toMatch(/SB 253/);
  });

  it("says Australia and Canada have calendar dates but no report list of their own", () => {
    for (const c of ["AU", "CA"]) {
      const p = countryProfile(c);
      expect(p.region).toBe("other");
      expect(p.notes.join(" ")).toMatch(/calendar lists/);
    }
  });

  it("is honest about a country with nothing loaded and about an unset country", () => {
    const jp = countryProfile("JP");
    expect(jp.region).toBe("other");
    expect(jp.notes.join(" ")).toMatch(/No national regulatory rules/);
    const none = countryProfile(null);
    expect(none.iso2).toBeNull();
    expect(none.recommendedReports).toEqual(countryProfile("GB").recommendedReports);
    expect(none.notes[0]).toMatch(/No country set/);
  });

  it("always leads with the GHG Protocol report, which every plan can generate", () => {
    for (const c of ["GB", "DE", "AE", "US", "JP", null]) {
      expect(countryProfile(c).recommendedReports[0]).toBe("ghg_protocol");
    }
  });
});
