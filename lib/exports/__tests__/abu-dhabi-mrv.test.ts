import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { aggregateStreams, buildMrvWorkbook } from "../abu-dhabi-mrv";
import { missingIdentifiers } from "../mrv-identifiers";

const row = (o: Partial<Parameters<typeof aggregateStreams>[0][number]> = {}) => ({
  categoryName: "Stationary combustion", fuelType: "Diesel", normalizedAmount: 1000, normalizedUnit: "litre",
  totalKg: 2500, factorValue: 2.5, factorSource: "DEFRA 2026.1", dataOrigin: "invoiced", ...o,
});

describe("aggregateStreams", () => {
  it("sums quantity and tonnes per stream and unit, never averaging", () => {
    const s = aggregateStreams([row(), row({ normalizedAmount: 500, totalKg: 1250 }), row({ fuelType: "Gas oil", totalKg: 100 })]);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ stream: "Stationary combustion: Diesel", quantity: 1500, tonnesCo2e: 3.75, records: 2, factorValue: 2.5 });
  });
  it("leaves the factor blank when records used different ones", () => {
    const s = aggregateStreams([row(), row({ factorValue: 2.6 })]);
    expect(s[0].factorValue).toBeNull();
  });
  it("keeps different units of one stream apart", () => {
    expect(aggregateStreams([row(), row({ normalizedUnit: "kWh" })])).toHaveLength(2);
  });
});

describe("missingIdentifiers", () => {
  it("lists what an operator still has to add", () => {
    expect(missingIdentifiers({ economicLicenceNumber: null, environmentalPermitNumber: "P1", address: "x", latitude: null, longitude: null }))
      .toEqual(["Economic licence number", "Coordinates of the main entrance"]);
  });
});

describe("buildMrvWorkbook", () => {
  it("writes identifiers, streams and a total", () => {
    const buf = buildMrvWorkbook({
      year: 2025, companyName: "Acme LLC", parentName: "Acme Group", facilityName: "Mussafah plant",
      economicLicenceNumber: "CN-1", environmentalPermitNumber: "EP-9", address: "Mussafah", latitude: 24.35, longitude: 54.5,
      streams: aggregateStreams([row()]), generatedOn: "3 October 2026",
    });
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["Read me", "Identifiers", "Source streams"]);
    const ids = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Identifiers"], { header: 1 });
    expect(ids[3]).toEqual(["Economic licence number", "CN-1"]);
    expect(ids[7][0]).toBe("Plus Code of the same position");
    expect(String(ids[7][1])).toMatch(/^[0-9A-Z]{8}\+[0-9A-Z]{2}$/);
    const streams = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets["Source streams"], { header: 1 });
    expect(streams.at(-1)?.[0]).toBe("Total Scope 1");
    expect(streams.at(-1)?.[5]).toBeCloseTo(2.5);
  });
});
