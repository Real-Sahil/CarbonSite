import { describe, it, expect } from "vitest";
import { generateCbamXml, validateCbamItems, type CbamReportData, type CbamGoodsItem } from "@/lib/reports/cbam-xml";

const baseItem: CbamGoodsItem = {
  cnCode: "7214",
  description: "Bars and rods of iron/non-alloy steel",
  quantityTonnes: 100,
  directEmbeddedCo2eTonnes: 140,
  indirectEmbeddedCo2eTonnes: 60,
  carbonPricePaidGbp: 0,
  installation: { name: "Supplier Mill", country: "DE" },
};

const baseReport: CbamReportData = {
  declarantName: "Test Construction Ltd",
  declarantEori: "GB123456789000",
  reportingPeriodLabel: "Q1 2025",
  periodStart: new Date("2025-01-01"),
  periodEnd: new Date("2025-03-31"),
  submissionDate: new Date("2025-04-15"),
  goodsItems: [baseItem],
};

describe("generateCbamXml", () => {
  it("produces valid XML with required root element", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<CBAMReport");
    expect(xml).toContain("</CBAMReport>");
  });

  it("includes declarant name and EORI", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<Name>Test Construction Ltd</Name>");
    expect(xml).toContain("<EORI>GB123456789000</EORI>");
  });

  it("includes reporting period", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<Label>Q1 2025</Label>");
    expect(xml).toContain("<StartDate>2025-01-01</StartDate>");
    expect(xml).toContain("<EndDate>2025-03-31</EndDate>");
  });

  it("includes goods item with CN code and emissions", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<CNCode>7214</CNCode>");
    expect(xml).toContain("<Value>100.000</Value>");
    expect(xml).toContain("<Unit>tonne</Unit>");
  });

  it("calculates summary totals correctly", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<TotalGoodsItems>1</TotalGoodsItems>");
    expect(xml).toContain("<TotalDirectEmbeddedCO2eTonnes>140.000000</TotalDirectEmbeddedCO2eTonnes>");
    expect(xml).toContain("<TotalIndirectEmbeddedCO2eTonnes>60.000000</TotalIndirectEmbeddedCO2eTonnes>");
    expect(xml).toContain("<TotalEmbeddedCO2eTonnes>200.000000</TotalEmbeddedCO2eTonnes>");
  });

  it("includes installation country when provided", () => {
    const xml = generateCbamXml(baseReport);
    expect(xml).toContain("<CountryOfOrigin>DE</CountryOfOrigin>");
  });

  it("emits EORI comment when EORI is omitted", () => {
    const report = { ...baseReport, declarantEori: undefined };
    const xml = generateCbamXml(report);
    expect(xml).toContain("<!-- EORI: required for final CBAM submission");
    expect(xml).not.toContain("<EORI>");
  });

  it("escapes XML special characters in declarant name", () => {
    const report = { ...baseReport, declarantName: "Smith & Sons <Ltd>" };
    const xml = generateCbamXml(report);
    expect(xml).toContain("Smith &amp; Sons &lt;Ltd&gt;");
  });

  it("computes specific emissions per tonne correctly", () => {
    const xml = generateCbamXml(baseReport);
    // specific = (140 + 60) / 100 = 2.000000
    expect(xml).toContain("<SpecificCO2eTonnesPerTonne>2.000000</SpecificCO2eTonnesPerTonne>");
  });

  it("handles multiple goods items with correct totals", () => {
    const item2: CbamGoodsItem = {
      cnCode: "2523",
      description: "Portland cement",
      quantityTonnes: 50,
      directEmbeddedCo2eTonnes: 40,
      indirectEmbeddedCo2eTonnes: 10,
      carbonPricePaidGbp: 500,
      installation: { name: "Cement Works", country: "TR" },
    };
    const report = { ...baseReport, goodsItems: [baseItem, item2] };
    const xml = generateCbamXml(report);
    expect(xml).toContain("<TotalGoodsItems>2</TotalGoodsItems>");
    expect(xml).toContain("<TotalDirectEmbeddedCO2eTonnes>180.000000</TotalDirectEmbeddedCO2eTonnes>");
    expect(xml).toContain("<TotalEmbeddedCO2eTonnes>250.000000</TotalEmbeddedCO2eTonnes>");
  });
});

describe("validateCbamItems", () => {
  it("returns empty array for valid items", () => {
    const errors = validateCbamItems([baseItem]);
    expect(errors).toEqual([]);
  });

  it("reports error for empty items list", () => {
    const errors = validateCbamItems([]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("No CBAM goods items");
  });

  it("reports error for invalid CN code", () => {
    const errors = validateCbamItems([{ ...baseItem, cnCode: "123" }]);
    expect(errors.some((e) => e.includes("CN code must be exactly 4 digits"))).toBe(true);
  });

  it("reports error for zero quantity", () => {
    const errors = validateCbamItems([{ ...baseItem, quantityTonnes: 0 }]);
    expect(errors.some((e) => e.includes("quantity must be > 0"))).toBe(true);
  });

  it("reports error for negative direct emissions", () => {
    const errors = validateCbamItems([{ ...baseItem, directEmbeddedCo2eTonnes: -1 }]);
    expect(errors.some((e) => e.includes("Direct embedded"))).toBe(true);
  });

  it("reports error for negative indirect emissions", () => {
    const errors = validateCbamItems([{ ...baseItem, indirectEmbeddedCo2eTonnes: -0.1 }]);
    expect(errors.some((e) => e.includes("Indirect embedded"))).toBe(true);
  });

  it("reports error for invalid country code length", () => {
    const errors = validateCbamItems([
      { ...baseItem, installation: { name: "Mill", country: "DEU" } },
    ]);
    expect(errors.some((e) => e.includes("2-letter ISO"))).toBe(true);
  });

  it("accepts items without installation", () => {
    const item = { ...baseItem, installation: undefined };
    const errors = validateCbamItems([item]);
    expect(errors).toEqual([]);
  });
});
