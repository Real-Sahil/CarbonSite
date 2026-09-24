// @vitest-environment node
import { describe, expect, it } from "vitest";
import { factorAttribution, withAttribution } from "../attribution";

describe("factor library attribution", () => {
  it("uses the OGL v3 attribution statement for DEFRA/DESNZ factors", () => {
    expect(factorAttribution({ name: "DEFRA", version: "2026.1", license: "Open Government Licence v3.0" })).toBe(
      "Emission factors: DEFRA 2026.1. Contains public sector information licensed under the Open Government Licence v3.0.",
    );
  });

  it("credits public domain and other licences, and says nothing without one", () => {
    expect(factorAttribution({ name: "EPA", version: "2025.1", license: "Public Domain (US Government Work)" })).toMatch(/public domain/);
    expect(factorAttribution({ name: "ADEME Base Carbone", version: "2025.04", license: "Licence Ouverte v2.0 (Etalab)" })).toMatch(/source: ADEME, Base Carbone, updated 2025\.04.*Licence Ouverte/);
    expect(factorAttribution({ name: "X", version: "1", license: "CC BY 4.0" })).toBe("Emission factors: X 1, used under CC BY 4.0.");
    expect(factorAttribution({ name: "X", version: "1", license: null })).toBeNull();
    expect(factorAttribution(null)).toBeNull();
  });

  it("adds the line to the end of an HTML report, escaped", () => {
    expect(withAttribution("<html><body><p>x</p></body></html>", "A & B")).toBe(
      '<html><body><p>x</p><p style="font-size:8pt;color:#64748b;margin:12px 40px 16px;font-family:inherit">A &amp; B</p></body></html>',
    );
    expect(withAttribution("<p>x</p>", null)).toBe("<p>x</p>");
  });
});
