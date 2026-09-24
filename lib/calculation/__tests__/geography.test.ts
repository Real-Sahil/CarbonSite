// @vitest-environment node
import { describe, expect, it } from "vitest";
import { countryIso2, recordCountry } from "../geography";

describe("countryIso2", () => {
  it("reads codes, aliases and English names", () => {
    expect(countryIso2("gb")).toBe("GB");
    expect(countryIso2(" UK ")).toBe("GB");
    expect(countryIso2("United Kingdom")).toBe("GB");
    expect(countryIso2("France")).toBe("FR");
    expect(countryIso2("Germany")).toBe("DE");
    expect(countryIso2("")).toBeNull();
    expect(countryIso2("Atlantis")).toBeNull();
  });
});

describe("recordCountry", () => {
  it("takes the record's country, then the facility's, then the organisation's", () => {
    expect(recordCountry("IE", "GB", "GB")).toBe("IE");
    expect(recordCountry(null, "United Kingdom", "FR")).toBe("GB");
    expect(recordCountry(undefined, "", "fr")).toBe("FR");
    expect(recordCountry(null, null, null)).toBeNull();
  });
});
