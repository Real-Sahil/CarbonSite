import { describe, expect, it } from "vitest";
import { renderSiteOperationsHtml } from "../templates/site-operations";
import { orgFormat } from "@/lib/i18n/org-format";
import type { SiteOperationsData } from "@/lib/site-operations/load";

const empty: SiteOperationsData = {
  period: { label: "FY2026", from: new Date("2026-01-01"), to: new Date("2026-12-31") },
  fuel: { stores: [], machines: [], sites: [] },
  plant: { assets: [], reconciliation: [] },
  movements: [],
  documents: [],
  registerChecks: { total: 0, found: 0, problems: 0 },
  swmp: [],
};
const base = { orgName: "Northgate Civils", format: orgFormat({ hqCountry: "GB", reportingCurrency: "GBP" }) };

describe("site operations report", () => {
  it("leaves out sections with nothing to show and says so", () => {
    const html = renderSiteOperationsHtml({ ...empty, ...base });
    expect(html).toContain("Nothing was recorded");
    expect(html).not.toContain("<h2>");
  });

  it("prints loads with open points and the register attribution, without claiming lawfulness", () => {
    const html = renderSiteOperationsHtml({
      ...empty,
      ...base,
      movements: [{ site: "Depot", material: "Soil", ewc: "17 05 03*", hazardous: true, status: "received", tonnes: 12.5, carrier: "A Haulier", destination: "Tip", issues: ["No lab evidence"] }],
      registerChecks: { total: 2, found: 1, problems: 1 },
      documents: [{ id: "d", kind: "site_permit", title: "Permit", issuer: "EA", reference: "EPR/AB1234CD", validUntil: new Date("2026-11-01"), extracted: null, kindLabel: "Site permit", state: "expiring" } as never],
    });
    expect(html).toContain("No lab evidence");
    expect(html).toContain("Environment Agency information");
    expect(html).toContain("do not say a load is lawful");
  });
});
