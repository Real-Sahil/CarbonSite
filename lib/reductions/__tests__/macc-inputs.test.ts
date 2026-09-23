// @vitest-environment node
import { describe, expect, it } from "vitest";
import { maccInputsIn, type InitiativeCostRow } from "../macc-inputs";
import { computeMacc } from "../macc";

const row = (over: Partial<InitiativeCostRow>): InitiativeCostRow => ({
  id: "i",
  name: "LED",
  capexAmount: null,
  costAmount: null,
  costCurrency: "GBP",
  opexDeltaAnnual: null,
  lifetimeYears: 10,
  expectedImpactCo2e: 10_000,
  ...over,
});
// 1 EUR = 0.85 GBP in this fixture; nothing else converts.
const convert = (amount: number, from: string, to: string) => (from === "EUR" && to === "GBP" ? amount * 0.85 : null);

describe("MACC inputs in one currency", () => {
  it("converts each initiative's costs to the reporting currency before ranking", () => {
    const { inputs, unconverted } = maccInputsIn(
      [
        row({ id: "gbp", name: "Heat pumps", capexAmount: 10_000 }),
        row({ id: "eur", name: "Solar", capexAmount: 10_000, costCurrency: "EUR", opexDeltaAnnual: -200 }),
      ],
      "GBP",
      convert,
    );
    expect(unconverted).toEqual([]);
    expect(inputs.find((i) => i.id === "eur")).toMatchObject({ capexAmount: 8_500, opexDeltaAnnual: -170, expectedImpactCo2e: 10 });
    // Per tonne: GBP 1000/10 = 100; EUR (850-170)/10 = 68, so solar ranks first.
    expect(computeMacc(inputs).map((e) => e.id)).toEqual(["eur", "gbp"]);
  });

  it("falls back to the legacy cost, and leaves out what cannot be converted", () => {
    const { inputs, unconverted } = maccInputsIn(
      [row({ id: "legacy", costAmount: 500 }), row({ id: "jpy", name: "Fleet", capexAmount: 1_000_000, costCurrency: "JPY" })],
      "GBP",
      convert,
    );
    expect(inputs.map((i) => [i.id, i.capexAmount])).toEqual([["legacy", 500]]);
    expect(unconverted).toEqual(["Fleet"]);
  });
});
