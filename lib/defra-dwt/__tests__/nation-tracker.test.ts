import { describe, expect, it } from "vitest";
import { siteNation } from "../nation";
import { receiptReportState } from "../tracker";

describe("siteNation", () => {
  it("reads the region the person entered first", () => {
    expect(siteNation({ region: "Scotland", postcode: "RG1 1AA" })).toBe("scotland");
    expect(siteNation({ region: "Wales" })).toBe("england-and-wales");
    expect(siteNation({ region: " Northern Ireland " })).toBe("northern-ireland");
  });
  it("falls back to the postcode area", () => {
    expect(siteNation({ postcode: "BT1 5GS" })).toBe("northern-ireland");
    expect(siteNation({ postcode: "EH1 1YZ" })).toBe("scotland");
    expect(siteNation({ postcode: "G1 1AA" })).toBe("scotland");
    expect(siteNation({ postcode: "rg1 1aa" })).toBe("england-and-wales");
  });
  it("returns null rather than guess", () => {
    expect(siteNation({})).toBeNull();
    expect(siteNation({ postcode: "TD15 1AA" })).toBeNull();
    expect(siteNation({ postcode: "DG1 1AA" })).toBeNull();
    expect(siteNation({ postcode: "IM1 1AA" })).toBeNull();
    expect(siteNation({ region: "Yorkshire" })).toBeNull();
    expect(siteNation({ country: "IE", postcode: "BT1 5GS" })).toBeNull();
  });
  it("accepts UK country names and codes", () => {
    expect(siteNation({ country: "GB", postcode: "BT1 5GS" })).toBe("northern-ireland");
    expect(siteNation({ country: "United Kingdom", postcode: "RG1 1AA" })).toBe("england-and-wales");
  });
});

describe("receiptReportState", () => {
  const start = { kind: "receipt", received: new Date("2026-10-05T09:00:00Z") } as const; // due Wed 7 Oct 23:59 BST
  const base = { start, nation: "england-and-wales" } as const;
  it("is open before the last day and due-today on it", () => {
    expect(receiptReportState({ ...base, now: new Date("2026-10-06T09:00:00Z") }).status).toBe("open");
    expect(receiptReportState({ ...base, now: new Date("2026-10-07T09:00:00Z") }).status).toBe("due-today");
  });
  it("is overdue after the deadline, by UK time", () => {
    expect(receiptReportState({ ...base, now: new Date("2026-10-07T22:59:59Z") }).status).toBe("due-today");
    expect(receiptReportState({ ...base, now: new Date("2026-10-07T23:00:00Z") }).status).toBe("overdue");
  });
  it("records on-time and late reports", () => {
    const now = new Date("2026-10-20T09:00:00Z");
    expect(receiptReportState({ ...base, now, reportedAt: new Date("2026-10-07T10:00:00Z") }).status).toBe("reported");
    expect(receiptReportState({ ...base, now, reportedAt: new Date("2026-10-08T10:00:00Z") }).status).toBe("reported-late");
  });
});
