import { describe, expect, it } from "vitest";
import { isCompanyNumber, toCandidates, toProfile } from "../companies-house";

describe("companies house parsing", () => {
  it("keeps only hits with a number and name", () => {
    const out = toCandidates({ items: [{ company_number: "00453791", title: "TARMAC TRADING LIMITED", company_status: "active", address: { postal_code: "B37 7ES" } }, { title: "no number" }, { company_number: "1" }] });
    expect(out).toEqual([{ number: "00453791", name: "TARMAC TRADING LIMITED", status: "active", address: null, postcode: "B37 7ES", incorporated: null }]);
    expect(toCandidates(null)).toEqual([]);
  });
  it("reads address and valid SIC codes, dropping junk", () => {
    const p = toProfile({ company_number: "00453791", company_name: "TARMAC", sic_codes: ["08110", "99999999", "abc", "42110"], registered_office_address: { address_line_1: "T3 Trinity Park", locality: "Birmingham", postal_code: "B37 7ES" } });
    expect(p?.sicCodes).toEqual(["08110", "42110"]);
    expect(p?.postcode).toBe("B37 7ES");
    expect(p?.address).toBe("T3 Trinity Park, Birmingham, B37 7ES");
    expect(toProfile({})).toBeNull();
  });
  it("accepts only 8-character numbers", () => {
    expect(isCompanyNumber("00453791")).toBe(true);
    expect(isCompanyNumber("SC123456")).toBe(true);
    expect(isCompanyNumber("453791")).toBe(false);
    expect(isCompanyNumber("../etc/pw")).toBe(false);
  });
});
