// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LOW_CONFIDENCE, suggestLedgerLine } from "../suggest";
import { ledgerRecords, type LedgerLineView } from "../xero-lines";

const s = (supplier: string, description = "") => suggestLedgerLine({ supplier, description });

describe("suggestLedgerLine", () => {
  it("sends fuel, energy and waste to 'needs a quantity' rather than pricing the spend", () => {
    expect(s("Certas Energy", "Red diesel delivery")).toMatchObject({ bucket: "needs_quantity", categoryCode: "s1-mobile" });
    expect(s("EDF Energy", "Electricity Jan")).toMatchObject({ bucket: "needs_quantity", categoryCode: "s2-electricity-lb" });
    expect(s("Yorwaste", "Skip hire and waste disposal")).toMatchObject({ bucket: "needs_quantity", categoryCode: "s3-waste" });
    expect(s("Calor Gas", "LPG supply")).toMatchObject({ bucket: "needs_quantity", categoryCode: "s1-stationary" });
  });

  it("prices materials, hire and haulage on spend, with an industry group where it knows one", () => {
    expect(s("Tarmac", "Ready-mix concrete C32/40")).toMatchObject({ bucket: "spend", categoryCode: "s3-purchased-goods", industryCode: "23.63" });
    expect(s("Celsa Steel UK", "Reinforcing steel")).toMatchObject({ bucket: "spend", industryCode: "24.10" });
    expect(s("Sunbelt Rentals", "Plant hire, 360 excavator")).toMatchObject({ bucket: "spend", industryCode: "77.32" });
    expect(s("ABC Haulage", "Haulage of arisings")).toMatchObject({ bucket: "spend", categoryCode: "s3-upstream-transport" });
    expect(s("Trainline", "Rail tickets")).toMatchObject({ bucket: "spend", categoryCode: "s3-business-travel" });
  });

  it("leaves tax, pay and finance out", () => {
    expect(s("HMRC", "VAT payment")).toMatchObject({ bucket: "not_emissions", categoryCode: null });
    expect(s("Barclays", "Bank charges")).toMatchObject({ bucket: "not_emissions" });
  });

  it("does not guess: an unrecognised line is for review with no category", () => {
    const r = s("Zed Holdings", "Misc");
    expect(r).toMatchObject({ bucket: "review", categoryCode: null, confidence: 0 });
  });

  it("keeps vague matches below the confidence line so they are shown as 'check this'", () => {
    expect(s("Brightside", "Insurance renewal").confidence).toBeLessThan(LOW_CONFIDENCE);
  });

  it("applies what the organisation already uses for a supplier, whatever the spelling", () => {
    const learned = new Map([["zed", "s3-capital-goods"]]);
    expect(suggestLedgerLine({ supplier: "Zed Ltd", description: "Misc" }, learned)).toMatchObject({ bucket: "spend", categoryCode: "s3-capital-goods", confidence: 0.9 });
    // ...but never for fuel or energy, which still need a quantity
    expect(suggestLedgerLine({ supplier: "Zed Ltd", description: "diesel" }, learned).bucket).toBe("needs_quantity");
  });
});

describe("ledgerRecords", () => {
  const line: LedgerLineView = {
    id: "l1", invoiceNumber: "INV-9", invoiceDate: "2025-03-14", supplier: "Tarmac", description: "Concrete",
    amount: 1200.5, suggestion: { bucket: "spend", categoryCode: "s3-purchased-goods", industryCode: "23.63", confidence: 0.85, reason: "Concrete" },
  };
  it("builds spend records in the organisation's currency and warns that spend is the basis", () => {
    const [r] = ledgerRecords([{ ...line, confirmed: { id: "l1", categoryCode: "s3-purchased-goods", industryCode: "23.63" } }], "EUR");
    expect(r).toMatchObject({ externalRecordId: "l1", emissionCategoryCode: "s3-purchased-goods", spendAmount: 1200.5, spendCurrency: "EUR", unit: "EUR", industryCode: "23.63", supplierName: "Tarmac" });
    expect(r.validationWarnings?.join(" ")).toMatch(/priced on spend/);
  });
});
