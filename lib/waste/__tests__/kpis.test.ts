import { describe, expect, it } from "vitest";
import { wasteKpi } from "../kpis";
import { documentState } from "../documents";

describe("wasteKpi", () => {
  const rows = [
    { tonnes: 60, route: "recycling_mixed" },
    { tonnes: 20, route: "incineration_efw" },
    { tonnes: 20, route: "landfill_mixed" },
  ];
  it("counts recycling and recovery as diverted and divides by value in 100k", () => {
    const k = wasteKpi(rows, 2_000_000, "Contract value");
    expect(k.tonnes).toBe(100);
    expect(k.divertedPct).toBe(80);
    expect(k.perHundredK).toBe(5);
  });
  it("gives no per-100k figure without a value, and says so", () => {
    const k = wasteKpi(rows, null, "Contract value in GBP");
    expect(k.perHundredK).toBeNull();
    expect(k.basis).toContain("not entered");
    expect(k.divertedPct).toBe(80);
  });
  it("handles no waste", () => expect(wasteKpi([], 1000, "x").divertedPct).toBeNull());
});

describe("documentState", () => {
  const now = new Date("2026-10-07");
  it("flags lapsed and soon-to-lapse licences, never transfer notes", () => {
    expect(documentState("carrier_licence", new Date("2026-10-01"), now)).toBe("expired");
    expect(documentState("site_permit", new Date("2026-10-20"), now)).toBe("expiring");
    expect(documentState("site_permit", new Date("2027-06-01"), now)).toBe("ok");
    expect(documentState("transfer_note", new Date("2020-01-01"), now)).toBe("no_date");
    expect(documentState("exemption", null, now)).toBe("no_date");
  });
});
