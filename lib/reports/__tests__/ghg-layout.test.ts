import { describe, expect, it } from "vitest";
import { renderGhgProtocolHtml } from "../templates/ghg-protocol";
import { defaultLayout, layoutSchema, normaliseLayout } from "../layout";

const d = new Date("2025-01-01T00:00:00Z");
const data = {
  orgName: "Acme", periodLabel: "FY25", periodStart: d, periodEnd: new Date("2025-12-31T00:00:00Z"),
  snapshotVersion: 2, publishedAt: d, publishedBy: "Sam", factorLibrary: "DEFRA 2025", methodology: "v1", gwpVersion: "AR6",
  scope1Kg: 1000, scope2LocationKg: 2000, scope2MarketKg: 500, scope3Kg: 3000, totalKg: 6000,
  co2Kg: 5000, ch4Kg: 500, n2oKg: 400, unsplitKg: 100, biogenicCo2Kg: 50,
  categories: [
    { code: "s1-stationary", name: "Stationary", scope: 1, totalKg: 1000, co2Kg: 900 },
    { code: "s2-electricity-lb", name: "Electricity", scope: 2, totalKg: 2000 },
    { code: "s3-waste", name: "Waste", scope: 3, totalKg: 3000 },
  ],
  baselineYear: "2020", baselineTonnes: 10, reductionPct: 40, recordCount: 12,
  evidenceTiers: { verified: 50, partial: 30, estimated: 20 },
  narrative: { executive_summary: "Hello\nWorld", key_findings: ["a", "b"], recommendations: "Do it" },
} as never;

const at = (html: string, text: string) => html.indexOf(text);

describe("normaliseLayout", () => {
  it("gives catalogue order with nothing hidden when no layout is saved", () => {
    const ids = normaliseLayout("ghg_protocol").map((b) => b.id);
    expect(ids[0]).toBe("header");
    expect(ids.at(-1)).toBe("footer");
    expect(normaliseLayout("ghg_protocol").every((b) => !b.hidden)).toBe(true);
  });

  it("drops unknown and repeated ids, and never hides a required block", () => {
    const out = normaliseLayout("ghg_protocol", {
      blocks: [{ id: "nope" }, { id: "assurance_note", hidden: true }, { id: "header", hidden: true }, { id: "assurance_note" }],
    });
    expect(out.find((b) => b.id === "nope")).toBeUndefined();
    expect(out.filter((b) => b.id === "assurance_note")).toHaveLength(1);
    expect(out.find((b) => b.id === "assurance_note")?.hidden).toBe(false);
    expect(out.find((b) => b.id === "header")?.hidden).toBe(false);
  });

  it("slots a block the saved layout predates after its default predecessor", () => {
    const saved = defaultLayout("ghg_protocol").blocks.filter((b) => b.id !== "scope2");
    const ids = normaliseLayout("ghg_protocol", { blocks: saved }).map((b) => b.id);
    expect(ids.indexOf("scope2")).toBe(ids.indexOf("scope1") + 1);
  });

  it("keeps fixed blocks in place however the layout orders them", () => {
    const ids = normaliseLayout("ghg_protocol", { blocks: [{ id: "footer" }, { id: "scope3" }, { id: "header" }] }).map((b) => b.id);
    expect(ids[0]).toBe("header");
    expect(ids.at(-1)).toBe("footer");
    expect(ids.indexOf("scope3")).toBeLessThan(ids.indexOf("scope1"));
  });

  it("returns nothing for a report type without a catalogue", () => {
    expect(normaliseLayout("inventory")).toEqual([]);
  });

  it("rejects an empty or oversized title in the schema", () => {
    expect(layoutSchema.safeParse({ blocks: [{ id: "scope1", title: "" }] }).success).toBe(false);
    expect(layoutSchema.safeParse({ blocks: [{ id: "scope1", title: "x".repeat(121) }] }).success).toBe(false);
  });
});

describe("renderGhgProtocolHtml with a layout", () => {
  it("renders the same page for the default layout as for none", () => {
    expect(renderGhgProtocolHtml(data, normaliseLayout("ghg_protocol"))).toBe(renderGhgProtocolHtml(data));
  });

  it("moves a section and keeps every figure", () => {
    const layout = normaliseLayout("ghg_protocol", {
      blocks: [{ id: "scope3" }, { id: "scope1" }],
    });
    const html = renderGhgProtocolHtml(data, layout);
    expect(at(html, "Scope 3 — Value Chain")).toBeLessThan(at(html, "Scope 1 — Direct"));
    expect(html).toContain("Scope 1 total");
    expect(html).toContain("Grand Total");
  });

  it("hides an optional section but not the assurance note", () => {
    const layout = normaliseLayout("ghg_protocol", {
      blocks: [{ id: "gas_breakdown", hidden: true }, { id: "assurance_note", hidden: true }],
    });
    const html = renderGhgProtocolHtml(data, layout);
    expect(html).not.toContain("Per-Gas Breakdown");
    expect(html).toContain("Reporting Assurance");
  });

  it("renames a heading and escapes the new title", () => {
    const layout = normaliseLayout("ghg_protocol", { blocks: [{ id: "scope1", title: "Our <direct> emissions" }] });
    const html = renderGhgProtocolHtml(data, layout);
    expect(html).toContain("Our &lt;direct&gt; emissions");
    expect(html).not.toContain("Scope 1 — Direct Emissions");
  });

  it("can drop the headline figures row", () => {
    const html = renderGhgProtocolHtml(data, normaliseLayout("ghg_protocol", { blocks: [{ id: "kpis", hidden: true }] }));
    expect(html).not.toContain('class="kpi-row"');
  });
});
