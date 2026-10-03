import { describe, expect, it } from "vitest";
import { caseStudyBody, caseStudyChecks, parseKpis } from "../index";

const full = { problem: "Diesel generators gave noise and fumes.", solution: "We hired two solar hybrid units.", baseline: "A standard diesel set running the same hours.", results: "Fuel use fell by about three quarters.", assumptions: "Diesel at the local pump price.", kpis: [{ label: "Fuel", value: "74%", note: "" }] };

describe("caseStudyBody", () => {
  it("needs a title and defaults the rest, unpublished", () => {
    const c = caseStudyBody.parse({ title: "Solar generators" });
    expect(c).toMatchObject({ contractId: null, kpis: [], published: false, problem: "" });
    expect(() => caseStudyBody.parse({ title: "x" })).toThrow();
  });
  it("allows at most six figures and no empty ones", () => {
    const k = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, value: `${i}` }));
    expect(caseStudyBody.safeParse({ title: "Ok title", kpis: k(6) }).success).toBe(true);
    expect(caseStudyBody.safeParse({ title: "Ok title", kpis: k(7) }).success).toBe(false);
    expect(caseStudyBody.safeParse({ title: "Ok title", kpis: [{ label: "", value: "1" }] }).success).toBe(false);
  });
});

describe("parseKpis", () => {
  it("drops malformed stored data", () => {
    expect(parseKpis("nonsense")).toEqual([]);
    expect(parseKpis([{ label: "Fuel", value: "74%" }])).toEqual([{ label: "Fuel", value: "74%", note: "" }]);
  });
});

describe("caseStudyChecks", () => {
  it("passes a complete case study", () => {
    expect(caseStudyChecks({ ...full, kpis: parseKpis(full.kpis) }).every((c) => c.ok)).toBe(true);
  });
  it("asks for a baseline and assumptions only when there are figures", () => {
    const noFigures = caseStudyChecks({ ...full, baseline: "", assumptions: "", kpis: [] });
    expect(noFigures.find((c) => c.id === "baseline")?.ok).toBe(true);
    const figures = caseStudyChecks({ ...full, baseline: "", assumptions: "", kpis: parseKpis(full.kpis) });
    expect(figures.find((c) => c.id === "baseline")?.ok).toBe(false);
    expect(figures.find((c) => c.id === "assumptions")?.ok).toBe(false);
  });
  it("asks for the story", () => {
    expect(caseStudyChecks({ ...full, results: "", kpis: [] }).find((c) => c.id === "story")?.ok).toBe(false);
  });
});
