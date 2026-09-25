import { describe, expect, it } from "vitest";
import { evidenceTier, summariseTiers, tierReasons } from "../evidence-tier";

const r = (dataOrigin: string, evidenceStatus: string, reviewStatus: string) =>
  ({ dataOrigin, evidenceStatus, reviewStatus }) as Parameters<typeof evidenceTier>[0];

describe("evidence tier", () => {
  it("is verified only for approved primary data with complete evidence", () => {
    expect(evidenceTier(r("invoiced", "complete", "approved"))).toBe("verified");
    expect(evidenceTier(r("metered", "complete", "approved"))).toBe("verified");
    expect(evidenceTier(r("invoiced", "partial", "approved"))).toBe("partial");
    expect(evidenceTier(r("invoiced", "missing", "approved"))).toBe("partial");
    expect(evidenceTier(r("invoiced", "complete", "draft"))).toBe("partial");
    expect(evidenceTier(r("invoiced", "missing", "draft"))).toBe("estimated");
  });

  it("never calls an estimate verified", () => {
    expect(evidenceTier(r("estimated", "complete", "approved"))).toBe("partial");
    expect(evidenceTier(r("proxy", "missing", "approved"))).toBe("estimated");
    expect(evidenceTier(r("extrapolated", "partial", "draft"))).toBe("estimated");
  });

  it("explains what is missing", () => {
    expect(tierReasons(r("proxy", "missing", "draft"))).toEqual(["Data origin: Proxy", "No evidence attached", "Not approved in review"]);
    expect(tierReasons(r("invoiced", "complete", "approved"))).toEqual([]);
  });

  it("splits emissions by tier", () => {
    const s = summariseTiers([
      { ...r("metered", "complete", "approved"), totalCo2e: 750 },
      { ...r("invoiced", "missing", "approved"), totalCo2e: 200 },
      { ...r("estimated", "missing", "draft"), totalCo2e: 50 },
    ]);
    expect(s.verified).toEqual({ records: 1, co2e: 750, percent: 75 });
    expect(s.partial.percent).toBe(20);
    expect(s.estimated.percent).toBe(5);
  });
});
