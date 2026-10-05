// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildChecklist, defaultMonth, findMissingSources, monthLabel, monthsBefore, monthsCovered, type ChecklistInput } from "../monthly";

const base: ChecklistInput = {
  month: "2026-09", hasPeriod: true, missingSources: [], fieldSubmissionsWaiting: 0, recordsInReview: 0, importsWaiting: 0,
  billsInInbox: 0, ledgerLinesWaiting: 0, recordsWithoutEvidence: 0, approvedChangedSinceRun: 0, hasRun: true, hasApprovedRecords: true,
};
const d = (s: string) => new Date(s + "T00:00:00Z");

describe("monthly checklist", () => {
  it("is empty when nothing is missing", () => {
    expect(buildChecklist(base)).toEqual([]);
  });

  it("gives every item a path in words and at least one link", () => {
    const items = buildChecklist({
      ...base, hasPeriod: false, fieldSubmissionsWaiting: 3, recordsInReview: 2, importsWaiting: 1, billsInInbox: 4, ledgerLinesWaiting: 9,
      recordsWithoutEvidence: 5, approvedChangedSinceRun: 7, missingSources: [{ facility: "Leeds depot", category: "Electricity", seenIn: ["2026-06", "2026-07", "2026-08"] }],
    });
    expect(items.length).toBeGreaterThanOrEqual(9);
    for (const i of items) {
      expect(i.where).toMatch(/→|\(/); // a route through the app, not just "go fix it"
      expect(i.fixes.length).toBeGreaterThan(0);
      for (const f of i.fixes) expect(f.path).toMatch(/^[a-z][A-Za-z0-9/_?=-]*$/);
    }
    expect(items.find((i) => i.id === "records-review")!.fixes[0].path).toBe("records?reviewStatus=in_review");
    expect(items.find((i) => i.id === "ledger")!.fixes[0].path).toBe("imports/from-accounting");
  });

  it("names the site, the source and the months it was seen in", () => {
    const [i] = buildChecklist({ ...base, missingSources: [{ facility: "Leeds depot", category: "Electricity", seenIn: ["2026-07", "2026-08"] }] });
    expect(i.title).toBe("Electricity for Leeds depot has nothing for September 2026");
    expect(i.detail).toContain("July 2026, August 2026");
    expect(i.fixes.map((f) => f.path)).toEqual(["records", "imports"]);
  });

  it("caps the missing-source list at eight and points at Records for the rest", () => {
    const many = Array.from({ length: 11 }, (_, k) => ({ facility: `Site ${k}`, category: "Gas", seenIn: ["2026-07", "2026-08"] }));
    const items = buildChecklist({ ...base, missingSources: many });
    expect(items.filter((i) => i.id.startsWith("missing:Site")).length).toBe(8);
    expect(items.find((i) => i.id === "missing:more")!.title).toMatch(/^3 more/);
  });

  it("asks for a first calculation, or a re-run when approved records changed after the last one", () => {
    expect(buildChecklist({ ...base, hasRun: false })[0].id).toBe("calc-first");
    expect(buildChecklist({ ...base, approvedChangedSinceRun: 2 })[0].id).toBe("calc-stale");
    expect(buildChecklist({ ...base, hasRun: false, hasApprovedRecords: false })).toEqual([]);
  });
});

describe("finding regular sources with nothing this month", () => {
  const rec = (facilityId: string | null, categoryId: string, months: string[]) => ({ facilityId, categoryId, months });
  it("needs the source in at least two of the three months before", () => {
    const records = [rec("f1", "elec", ["2026-06"]), rec("f2", "elec", ["2026-07", "2026-08"]), rec("f3", "elec", ["2026-06", "2026-08"])];
    expect(findMissingSources(records, "2026-09").map((m) => m.facilityId)).toEqual(["f2", "f3"]);
  });
  it("ignores a source that does have the month, and records with no facility", () => {
    const records = [rec("f1", "elec", ["2026-07", "2026-08", "2026-09"]), rec(null, "elec", ["2026-07", "2026-08"])];
    expect(findMissingSources(records, "2026-09")).toEqual([]);
  });
  it("counts a billing range in every month it covers", () => {
    expect(monthsCovered({ startDate: d("2026-06-15"), endDate: d("2026-08-14"), activityDate: null })).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(monthsCovered({ startDate: null, endDate: null, activityDate: d("2026-05-02") })).toEqual(["2026-05"]);
    expect(monthsCovered({ startDate: null, endDate: null, activityDate: null })).toEqual([]);
  });
});

describe("months", () => {
  it("reads the month before now and labels it", () => {
    expect(defaultMonth(d("2026-10-03"))).toBe("2026-09");
    expect(defaultMonth(d("2026-01-03"))).toBe("2025-12");
    expect(monthLabel("2026-09")).toBe("September 2026");
    expect(monthsBefore("2026-02", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});
