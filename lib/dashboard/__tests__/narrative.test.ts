import { describe, expect, it } from "vitest";
import { auditLine, glidepathLine, greeting, hotspotLine, needsYouLine, socialPhaseLine } from "../narrative";

const fmt = { tonnes: (n: number) => `${n} t`, percent: (n: number) => `${n}%` };
const base = { firstName: "Sam", hour: 9, hasData: true, periodLabel: "FY2026", totalTonnes: 120, changePct: -4, fmt };

describe("greeting", () => {
  it("states a fall plainly", () => {
    expect(greeting(base)).toBe("Good morning, Sam. 120 t recorded for FY2026, down 4% on the previous period.");
  });
  it("states a rise as flatly", () => {
    expect(greeting({ ...base, changePct: 6 })).toContain("up 6% on the previous period");
  });
  it("handles a level period", () => {
    expect(greeting({ ...base, changePct: 0 })).toContain("level with the previous period");
  });
  it("drops the change when there is no comparable period", () => {
    expect(greeting({ ...base, changePct: null })).toBe("Good morning, Sam. 120 t recorded for FY2026.");
  });
  it("first run asks for data", () => {
    expect(greeting({ ...base, hasData: false })).toContain("Nothing is recorded yet");
  });
  it("uses the right part of the day and copes with no name", () => {
    expect(greeting({ ...base, firstName: null, hour: 14 })).toMatch(/^Good afternoon\./);
    expect(greeting({ ...base, hour: 20 })).toMatch(/^Good evening, Sam\./);
  });
});

describe("needsYouLine", () => {
  it("is null when quiet", () => expect(needsYouLine({ pendingSubmissions: 0, openReviews: 0 })).toBeNull());
  it("singular", () => expect(needsYouLine({ pendingSubmissions: 1, openReviews: 0 })).toBe("One item needs you."));
  it("sums", () => expect(needsYouLine({ pendingSubmissions: 2, openReviews: 3 })).toBe("5 items need you."));
});

describe("glidepathLine", () => {
  const g = (status: "ahead" | "on_track" | "behind", partial = false) => ({ expectedTonnes: 100, gapTonnes: status === "ahead" ? -8 : status === "behind" ? 8 : 0, status, partial });
  it("null without a target", () => expect(glidepathLine(null, fmt)).toBeNull());
  it("behind", () => expect(glidepathLine(g("behind"), fmt)).toBe("8 t above the straight path to your target."));
  it("ahead, part way through", () => expect(glidepathLine(g("ahead", true), fmt)).toBe("8 t below the straight path to your target so far this period (indicative)."));
  it("on track", () => expect(glidepathLine(g("on_track"), fmt)).toBe("In line with the straight path to your target."));
});

describe("hotspotLine", () => {
  it("null without data", () => expect(hotspotLine(null, fmt)).toBeNull());
  it("null for a zero share", () => expect(hotspotLine({ label: "Fuel", sharePct: 0 }, fmt)).toBeNull());
  it("names the source", () => expect(hotspotLine({ label: "Fuel", sharePct: 41 }, fmt)).toBe("Fuel is the largest source, 41% of the total."));
});

describe("socialPhaseLine", () => {
  it("null when unknown", () => expect(socialPhaseLine(null)).toBeNull());
  it("names the phase, never a grade", () => expect(socialPhaseLine("initial_audit")).toBe("Social data is at the Initial Audit phase."));
});

describe("auditLine", () => {
  it("null without a regime or set", () => {
    expect(auditLine(null)).toBeNull();
    expect(auditLine({ regimeLabel: "TCFD", ready: 0, partly: 0, total: 0 })).toBeNull();
  });
  it("uses ready and partly ready", () => {
    expect(auditLine({ regimeLabel: "TCFD", ready: 3, partly: 2, total: 11 })).toBe("3 of 11 TCFD datapoints ready, 2 partly ready.");
  });
});
