import { describe, expect, it } from "vitest";
import { CONFIDENT_MATCH, rankMatches, scoreRecordMatch, type MatchableRecord } from "../match";
import type { BillExtraction } from "../bill-extractor";

const bill = (over: Partial<BillExtraction> = {}): BillExtraction => ({
  kind: "electricity",
  categoryCode: "s2-electricity-lb",
  amount: { value: 1850, confidence: 0.9 },
  unit: "kWh",
  fuelType: null,
  supplier: { value: "EDF", confidence: 0.8 },
  invoiceNumber: null,
  periodStart: { value: "2025-04-01", confidence: 0.85 },
  periodEnd: { value: "2025-04-30", confidence: 0.85 },
  issueDate: null,
  alternatives: [2100],
  notes: [],
  ...over,
});

const rec = (over: Partial<MatchableRecord> = {}): MatchableRecord => ({
  id: "r1",
  amount: 1850,
  unit: "kWh",
  activityDate: new Date("2025-04-30"),
  startDate: new Date("2025-04-01"),
  endDate: new Date("2025-04-30"),
  supplierName: "EDF Energy",
  categoryCode: "s2-electricity-lb",
  sourceDescription: "Half-hourly meter",
  evidenceStatus: "missing",
  ...over,
});

describe("scoreRecordMatch", () => {
  it("scores quantity, supplier, period and category", () => {
    const m = scoreRecordMatch(bill(), rec());
    expect(m?.score).toBe(100);
    expect(m?.reasons).toEqual(["Same quantity", "Same supplier", "Dates overlap the billing period", "Same category"]);
    expect(m!.score).toBeGreaterThanOrEqual(CONFIDENT_MATCH);
  });

  it("converts units before comparing", () => {
    expect(scoreRecordMatch(bill(), rec({ amount: 1.85, unit: "MWh" }))).not.toBeNull();
  });

  it("never matches on a different quantity", () => {
    expect(scoreRecordMatch(bill(), rec({ amount: 1700 }))).toBeNull();
    expect(scoreRecordMatch(bill({ unit: null }), rec())).toBeNull();
  });

  it("marks a match on an alternative quantity", () => {
    const m = scoreRecordMatch(bill(), rec({ amount: 2100 }));
    expect(m?.reasons).toContain("Quantity is not the one read as consumption");
    expect(m!.score).toBeLessThan(100);
  });
});

describe("rankMatches", () => {
  it("puts records without evidence first and drops weak matches", () => {
    const ranked = rankMatches(bill(), [
      rec({ id: "has", evidenceStatus: "complete" }),
      rec({ id: "none" }),
      rec({ id: "weak", supplierName: "Other", categoryCode: "s1-stationary", startDate: null, endDate: null, activityDate: new Date("2024-01-01"), amount: 2100 }),
    ]);
    expect(ranked.map((m) => m.recordId)).toEqual(["none", "has"]);
  });
});
