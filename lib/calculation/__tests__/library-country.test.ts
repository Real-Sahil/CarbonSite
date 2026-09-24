// @vitest-environment node
import { describe, expect, it } from "vitest";
import { libraryCountry, libraryCountryMismatch } from "../library-country";

describe("library country", () => {
  it("knows the home country of each library", () => {
    expect(libraryCountry("DEFRA")).toBe("GB");
    expect(libraryCountry("Defra UK spend multipliers")).toBe("GB");
    expect(libraryCountry("EPA USEEIO")).toBe("US");
    expect(libraryCountry("ADEME Base Carbone")).toBe("FR");
    expect(libraryCountry("Custom")).toBeNull();
  });

  it("flags a library for another country than the organisation's", () => {
    expect(libraryCountryMismatch("EPA", "United Kingdom")).toMatch(/written for US/);
    expect(libraryCountryMismatch("DEFRA", "GB")).toBeNull();
    expect(libraryCountryMismatch("DEFRA", null)).toBeNull();
    expect(libraryCountryMismatch("DEFRA", "Ireland")).toMatch(/based in IE/);
  });
});
