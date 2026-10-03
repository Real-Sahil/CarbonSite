import { describe, expect, it } from "vitest";
import { renderSiteNoticeboardHtml } from "@/lib/reports/templates/site-noticeboard";
import type { NoticeboardData } from "../load";

const contract = (over: object = {}) => ({
  id: "c1", name: "Riverside <Phase 2>", client: "Acme Council", reference: "AC-2026-14", value: 5_000_000, currency: "GBP",
  startDate: null, endDate: null, tonnes: 412.6, tonnesPerMillion: 82.5, budgetTonnes: 500, socialValuePounds: 0,
  socialValue: { targetPounds: null, themes: [], measures: [] }, ppn026: [], wasteTonnes: 800, diversionRate: 0.95, ...over,
});
const data = (over: Partial<NoticeboardData> = {}, c: object = {}): NoticeboardData => ({
  orgName: "Northgate Civils",
  pack: { snapshot: { version: 2, periodLabel: "FY2025" } } as never,
  contract: contract(c) as never,
  caseStudies: [],
  policies: [],
  format: { locale: "en-GB", currency: "GBP" },
  ...over,
});
const study = { id: "s", title: "Solar generators", problem: "Noise and fumes.", solution: "Two hybrid units.", baseline: "A diesel set running the same hours.", results: "Fuel fell by about three quarters.", kpis: [{ label: "Fuel saved", value: "74%", note: "" }], assumptions: "Local diesel price." };

describe("renderSiteNoticeboardHtml", () => {
  it("shows measured carbon, budget use and waste diversion from the snapshot", () => {
    const html = renderSiteNoticeboardHtml(data());
    expect(html).toContain("412.6");
    expect(html).toContain("83%"); // 412.6 of 500
    expect(html).toContain("95.0%");
    expect(html).toContain("published snapshot v2");
  });

  it("leaves out a tile whose figure does not exist", () => {
    const html = renderSiteNoticeboardHtml(data({}, { budgetTonnes: null, diversionRate: null }));
    expect(html).not.toContain("carbon budget used");
    expect(html).not.toContain("diverted from landfill");
    expect(html).not.toContain("social value delivered, GBP");
  });

  it("labels social value as GBP whatever the organisation's currency", () => {
    const html = renderSiteNoticeboardHtml(
      data({ format: { locale: "en-US", currency: "USD" } }, { socialValuePounds: 5000, socialValue: { targetPounds: null, themes: [{ code: "t", name: "Local jobs", pounds: 5000 }], measures: [] } }),
    );
    expect(html).toContain("£5,000");
    expect(html).not.toContain("$5,000");
    expect(html).toContain("Local jobs");
  });

  it("prints case studies with their baseline and assumptions, and says the figures are the organisation's own", () => {
    const html = renderSiteNoticeboardHtml(data({ caseStudies: [study] }));
    expect(html).toContain("Solar generators");
    expect(html).toContain("74%");
    expect(html).toContain("A diesel set running the same hours");
    expect(html).toContain("Local diesel price");
    expect(html).toContain("stated by the organisation");
  });

  it("says when a figure has no baseline or assumptions rather than hiding it", () => {
    const html = renderSiteNoticeboardHtml(data({ caseStudies: [{ ...study, baseline: "", assumptions: "" }] }));
    expect(html).toContain("not stated");
  });

  it("omits the case study section when there are none, and escapes text", () => {
    const html = renderSiteNoticeboardHtml(data());
    expect(html).not.toContain("What we are doing on this project");
    expect(html).toContain("Riverside &lt;Phase 2&gt;");
  });
});

import { noticeboardPolicies } from "@/lib/case-studies";

describe("case study photo", () => {
  it("prints the photo on its card and leaves the card plain without one", () => {
    const withPhoto = renderSiteNoticeboardHtml(data({ caseStudies: [{ ...study, photoDataUri: "data:image/png;base64,AAAA" }] }));
    expect(withPhoto).toContain('<img class="photo" src="data:image/png;base64,AAAA"');
    expect(renderSiteNoticeboardHtml(data({ caseStudies: [study] }))).not.toContain("<img");
  });
});

describe("noticeboard policy statement", () => {
  const pol = (o: Partial<Parameters<typeof noticeboardPolicies>[0][number]> = {}) => ({
    title: "Environmental policy", category: null, body: "We will cut waste.", version: 1, status: "approved", approvedOn: null, ...o,
  });
  it("prints only approved environmental policies with text, highest version, never an internal one", () => {
    const out = noticeboardPolicies([
      pol(), pol({ version: 3, body: "Version three." }), pol({ title: "Information security policy", body: "Secret." }),
      pol({ title: "Draft carbon policy", status: "draft" }), pol({ title: "Energy policy", body: "  " }),
      pol({ title: "Quality manual", category: "Climate and quality" }),
    ]);
    expect(out.map((p) => `${p.title} v${p.version}`)).toEqual(["Environmental policy v3", "Quality manual v1"]);
  });
  it("shows the policy on the board with its version, and nothing when there is none", () => {
    const withPolicy = renderSiteNoticeboardHtml(data({ policies: [{ title: "Environmental policy", version: 3, approvedOn: new Date("2026-01-05"), body: "We will cut waste." }] }));
    expect(withPolicy).toContain("Our policy");
    expect(withPolicy).toContain("Version 3, approved 5 January 2026");
    expect(renderSiteNoticeboardHtml(data())).not.toContain("Our policy");
  });
});
