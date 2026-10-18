import { describe, expect, it } from "vitest";
import { aggregatesToCsv } from "../export-csv";

const agg = (totalCo2e: string) => ({
  scope: 1,
  totalCo2e,
  recordCount: 3,
  intensityPerRevenueUnit: null,
  intensityPerFte: null,
  intensityPerM2: null,
  emissionCategory: { code: "s1-stationary", name: "Stationary" },
  facility: null,
  businessUnit: null,
  scope2Method: null,
});

describe("aggregatesToCsv", () => {
  it("writes the total in tonnes, because the aggregates hold kg", () => {
    const [header, row] = aggregatesToCsv([agg("2500")]).split("\n");
    expect(header.split(",")[5]).toBe("CO2e (tonnes)");
    expect(row.split(",")[5]).toBe("2.5000");
  });

  it("quotes a field that holds a comma", () => {
    const csv = aggregatesToCsv([{ ...agg("1000"), facility: { name: "Depot, north" } }]);
    expect(csv.split("\n")[1]).toContain('"Depot, north"');
  });
});
