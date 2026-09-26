// @vitest-environment node
import { describe, expect, it } from "vitest";
import { matchWatch, parseNoticeId, summariseRelease, tenderFlags, type OcdsRelease } from "../fts";
import { contractDraft, draftWarnings } from "../import";

// Trimmed from the live Find a Tender API, 26 September 2026.
const TENDER: OcdsRelease = {
  ocid: "ocds-h6vhtk-077b05",
  id: "091204-2026",
  date: "2026-09-25T23:16:45+01:00",
  tag: ["tender"],
  tender: {
    id: "H&C1025",
    title: "H&C1025 Sexual Health Services",
    status: "active",
    classification: { scheme: "CPV", id: "85000000" },
    value: { amount: 8400000, currency: "GBP" },
    items: [{ additionalClassifications: [{ scheme: "CPV", id: "85140000" }, { scheme: "CPV", id: "85141000" }], deliveryAddresses: [{ region: "UKE12" }] }],
    tenderPeriod: { endDate: "2026-10-26T12:00:00Z" },
  },
  parties: [
    { id: "GB-FTS-33279", name: "East Riding of Yorkshire Council", roles: ["buyer"], details: { classifications: [{ scheme: "TED_CA_TYPE", id: "REGIONAL_AUTHORITY" }, { scheme: "COFOG", id: "07" }] } },
    { id: "GB-FTS-6209", name: "The High Court", roles: ["reviewBody"], details: {} },
  ],
  buyer: { id: "GB-FTS-33279", name: "East Riding of Yorkshire Council" },
};
const AWARD: OcdsRelease = {
  ocid: "ocds-h6vhtk-077b03",
  id: "091200-2026",
  date: "2026-09-25T19:13:23+01:00",
  tag: ["award", "contract"],
  tender: {
    id: "DN825389",
    title: "Lot 2: Minibus - Individual routes (public and education transport)",
    status: "complete",
    classification: { scheme: "CPV", id: "60100000" },
    items: [{ deliveryAddresses: [{ region: "UKK14" }] }],
  },
  awards: [{ suppliers: [{ id: "GB-FTS-183297", name: "Green Destinations Ltd" }] }],
  contracts: [{ value: { amount: 4356092, currency: "GBP" }, dateSigned: "2026-08-27T00:00:00+01:00" }],
  parties: [{ id: "GB-FTS-183297", name: "Green Destinations Ltd", roles: ["supplier"] }],
  buyer: { name: "Wiltshire Council" },
};

describe("parseNoticeId", () => {
  it("takes a notice number or a notice link", () => {
    expect(parseNoticeId("091200-2026")).toBe("091200-2026");
    expect(parseNoticeId("https://www.find-tender.service.gov.uk/Notice/091200-2026?origin=SearchResults")).toBe("091200-2026");
    expect(parseNoticeId("tender 12345")).toBeNull();
  });
});

describe("summariseRelease", () => {
  it("reads a tender notice", () => {
    const n = summariseRelease(TENDER);
    expect(n).toMatchObject({
      noticeId: "091204-2026",
      stage: "tender",
      buyerName: "East Riding of Yorkshire Council",
      buyerType: "REGIONAL_AUTHORITY",
      value: 8400000,
      currency: "GBP",
      cpvCodes: ["85000000", "85140000", "85141000"],
      regions: ["UKE12"],
      tenderReference: "H&C1025",
    });
    expect(n.deadline?.toISOString()).toBe("2026-10-26T12:00:00.000Z");
  });

  it("reads an award notice's signed value and supplier", () => {
    const n = summariseRelease(AWARD);
    expect(n).toMatchObject({ stage: "award", value: 4356092, suppliers: ["Green Destinations Ltd"], buyerName: "Wiltshire Council" });
  });
});

describe("tenderFlags", () => {
  it("says a Carbon Reduction Plan is only possible for a local authority over £5m", () => {
    const flags = tenderFlags(summariseRelease(TENDER));
    expect(flags).toEqual([expect.objectContaining({ code: "crp", level: "possible" })]);
  });

  it("says likely for central government over £5m a year, with social value", () => {
    const central = summariseRelease({
      ...TENDER,
      tender: { ...TENDER.tender, contractPeriod: { startDate: "2027-04-01", endDate: "2029-03-31" }, value: { amount: 24_000_000, currency: "GBP" } },
      parties: [{ name: "Department for Transport", roles: ["buyer"], details: { classifications: [{ scheme: "TED_CA_TYPE", id: "MINISTRY" }] } }],
    });
    const flags = tenderFlags(central);
    expect(flags.find((f) => f.code === "crp")).toMatchObject({ level: "likely" });
    expect(flags.find((f) => f.code === "social_value")?.label).toBe("Social value (PPN 002)");
  });

  it("uses the annual value: £8m over four years is not over £5m a year", () => {
    const central = summariseRelease({
      ...TENDER,
      tender: { ...TENDER.tender, contractPeriod: { startDate: "2027-01-01", endDate: "2030-12-31" }, value: { amount: 8_000_000, currency: "GBP" } },
      parties: [{ name: "HM Revenue & Customs", roles: ["buyer"], details: { classifications: [{ scheme: "TED_CA_TYPE", id: "MINISTRY" }] } }],
    });
    expect(tenderFlags(central).find((f) => f.code === "crp")).toMatchObject({ level: "possible" });
  });

  it("reads the Procurement Act buyer type (UK_CA_TYPE) before TED_CA_TYPE", () => {
    const n = summariseRelease({
      ...TENDER,
      tender: { ...TENDER.tender, value: { amount: 12_000_000, currency: "GBP" } },
      parties: [{ name: "Environment Agency", roles: ["buyer"], details: { classifications: [{ scheme: "UK_CA_TYPE", id: "publicAuthorityCentralGovernment" }] } }],
    });
    expect(n.buyerType).toBe("publicAuthorityCentralGovernment");
    expect(tenderFlags(n).find((f) => f.code === "crp")).toMatchObject({ level: "likely" });
  });

  it("names PPN 026 for central government procurements from 2027", () => {
    const n = { ...summariseRelease(TENDER), buyerType: "NATIONAL_AGENCY", publishedAt: new Date("2027-02-01"), value: 2_000_000 };
    expect(tenderFlags(n).find((f) => f.code === "social_value")?.label).toBe("Social value (PPN 026 model)");
  });
});

describe("matchWatch", () => {
  const n = summariseRelease(TENDER);
  const base = { cpvPrefixes: [] as string[], regions: [] as string[], keywords: [] as string[], minValue: null as number | null };

  it("matches on a CPV prefix or a title keyword", () => {
    expect(matchWatch(n, { ...base, cpvPrefixes: ["8514"] })).toBe("CPV 8514");
    expect(matchWatch(n, { ...base, keywords: ["sexual health"] })).toBe('"sexual health" in the title');
    expect(matchWatch(n, { ...base, cpvPrefixes: ["45"] })).toBeNull();
  });

  it("filters by region and minimum value", () => {
    expect(matchWatch(n, { ...base, cpvPrefixes: ["85"], regions: ["UKE"] })).not.toBeNull();
    expect(matchWatch(n, { ...base, cpvPrefixes: ["85"], regions: ["UKI"] })).toBeNull();
    expect(matchWatch(n, { ...base, cpvPrefixes: ["85"], minValue: 10_000_000 })).toBeNull();
  });
});

describe("contract import", () => {
  it("drafts a contract from an award and warns when another supplier won it", () => {
    const n = summariseRelease(AWARD);
    expect(contractDraft(n)).toMatchObject({
      name: "Lot 2: Minibus - Individual routes (public and education transport)",
      clientName: "Wiltshire Council",
      contractValue: 4356092,
      currency: "GBP",
      ftsNoticeId: "091200-2026",
      tenderReference: "DN825389",
    });
    expect(draftWarnings(n, "Northgate Civils Ltd").join(" ")).toMatch(/names Green Destinations Ltd as the supplier/);
    expect(draftWarnings(n, "Green Destinations Limited").join(" ")).not.toMatch(/as the supplier/);
  });

  it("warns that a tender notice's value is an estimate", () => {
    expect(draftWarnings(summariseRelease(TENDER), "Acme").join(" ")).toMatch(/buyer's estimate/);
  });
});
