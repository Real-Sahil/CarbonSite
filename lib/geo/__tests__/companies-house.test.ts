import { describe, expect, it } from "vitest";
import { companyFlags, isCompanyNumber, smeHint, toCandidates, toCorporateOwners, toProfile } from "../companies-house";

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

describe("supplier facts", () => {
  it("reads accounts, insolvency and jurisdiction", () => {
    const p = toProfile({ company_number: "00453791", company_name: "X", company_status: "liquidation", has_insolvency_history: true, jurisdiction: "england-wales", accounts: { overdue: true, last_accounts: { type: "small" } } });
    expect(p).toMatchObject({ accountsType: "small", accountsOverdue: true, hasInsolvencyHistory: true, jurisdiction: "england-wales" });
    expect(companyFlags(p!)).toEqual([
      { level: "red", text: "Company is liquidation" },
      { level: "amber", text: "Insolvency history on the register" },
      { level: "amber", text: "Accounts overdue" },
    ]);
  });
  it("raises no flag for a healthy active company", () => {
    expect(companyFlags({ status: "active", accountsOverdue: false, hasInsolvencyHistory: false })).toEqual([]);
  });
  it("hints SME only for small filings, never says no", () => {
    expect(smeHint("micro-entity")).toContain("suggests an SME");
    expect(smeHint("small")).not.toBeNull();
    expect(smeHint("full")).toBeNull();
    expect(smeHint(null)).toBeNull();
  });
  it("lists only current corporate owners, never people", () => {
    const out = toCorporateOwners({ items: [
      { kind: "corporate-entity-person-with-significant-control", name: "PARENT HOLDINGS LTD", identification: { registration_number: "01234567" }, natures_of_control: ["ownership-of-shares-75-to-100-percent"] },
      { kind: "individual-person-with-significant-control", name: "A PERSON", natures_of_control: ["ownership-of-shares-25-to-50-percent"] },
      { kind: "corporate-entity-person-with-significant-control", name: "OLD OWNER LTD", ceased_on: "2020-01-01" },
    ] });
    expect(out).toEqual([{ name: "PARENT HOLDINGS LTD", number: "01234567", sharesBand: "75-100" }]);
    expect(toCorporateOwners(null)).toEqual([]);
  });
});

describe("key handling", () => {
  it("sends a clean Basic header even when the env value carries quotes or whitespace", async () => {
    const seen: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { seen.push(String((init?.headers as Record<string, string>).Authorization)); return new Response("{}", { status: 200 }); }) as typeof fetch;
    process.env.COMPANIES_HOUSE_API_KEY = ' "abc-123_DEF"\n';
    try {
      const { searchCompanies } = await import("../companies-house");
      await searchCompanies("tarmac");
    } finally {
      globalThis.fetch = orig;
      delete process.env.COMPANIES_HOUSE_API_KEY;
    }
    expect(seen[0]).toBe(`Basic ${Buffer.from("abc-123_DEF:").toString("base64")}`);
  });
});
