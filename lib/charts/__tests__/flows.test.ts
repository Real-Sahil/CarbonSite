import { describe, expect, it } from "vitest";
import { buildFlows } from "../sankey";
import { buildWaterfall } from "../waterfall";

const names = { category: (id: string) => `Cat ${id}`, facility: (id: string) => `Site ${id}` };
const rows = [
  { scope: 1, emissionCategoryId: "c1", facilityId: "f1", totalCo2e: "10" },
  { scope: 1, emissionCategoryId: "c1", facilityId: "f2", totalCo2e: 5 },
  { scope: 2, emissionCategoryId: "c2", facilityId: "f1", totalCo2e: 20 },
  { scope: 3, emissionCategoryId: "c3", facilityId: null, totalCo2e: 7 },
  { scope: 3, emissionCategoryId: "c4", facilityId: "f3", totalCo2e: 3 },
  { scope: 3, emissionCategoryId: "c5", facilityId: "f3", totalCo2e: 0 },
];

describe("buildFlows", () => {
  it("conserves the total at every level", () => {
    const f = buildFlows(rows, names);
    expect(f.totalKg).toBe(45);
    const level = (from: string, to: string) =>
      f.links.filter((l) => l.source.startsWith(from) && l.target.startsWith(to)).reduce((s, l) => s + l.value, 0);
    expect(level("scope:", "category:")).toBe(45);
    expect(level("category:", "site:")).toBe(45);
  });

  it("folds the smallest categories and sites into other nodes without losing a kilogram", () => {
    const f = buildFlows(rows, names, { categories: 2, sites: 1 });
    expect(f.nodes.map((n) => n.label)).toContain("Other Scope 3 categories");
    expect(f.nodes.map((n) => n.label)).toContain("Other sites");
    expect(f.nodes.map((n) => n.label)).toContain("No site recorded");
    const intoSites = f.links.filter((l) => l.target.startsWith("site:")).reduce((s, l) => s + l.value, 0);
    expect(intoSites).toBe(45);
    // every link end is a node
    const ids = new Set(f.nodes.map((n) => n.id));
    expect(f.links.every((l) => ids.has(l.source) && ids.has(l.target))).toBe(true);
  });

  it("is empty for no emissions", () => {
    expect(buildFlows([], names)).toEqual({ nodes: [], links: [], totalKg: 0 });
  });
});

describe("buildWaterfall", () => {
  const prev = [{ id: "a", label: "A", kg: 100 }, { id: "b", label: "B", kg: 50 }, { id: "c", label: "C", kg: 10 }];
  const curr = [{ id: "a", label: "A", kg: 80 }, { id: "b", label: "B", kg: 70 }, { id: "d", label: "D", kg: 5 }];

  it("adds up from previous to current", () => {
    const steps = buildWaterfall(prev, curr, { previous: "FY1", current: "FY2" }, 2);
    expect(steps[0]).toMatchObject({ label: "FY1", value: 160 });
    expect(steps.at(-1)).toMatchObject({ label: "FY2", value: 155 });
    const changes = steps.filter((s) => s.kind === "change");
    expect(changes.reduce((s, c) => s + c.value, 0)).toBe(-5);
    expect(steps[0].value + changes.reduce((s, c) => s + c.value, 0)).toBe(steps.at(-1)!.value);
    expect(changes.map((c) => c.label)).toEqual(["A", "B", "All other categories"]);
  });

  it("chains each change from the last, ignores unchanged categories", () => {
    const steps = buildWaterfall([{ id: "a", label: "A", kg: 5 }], [{ id: "a", label: "A", kg: 5 }], { previous: "P", current: "C" });
    expect(steps.map((s) => s.kind)).toEqual(["total", "total"]);
    const s2 = buildWaterfall(prev, curr, { previous: "P", current: "C" });
    const ch = s2.filter((s) => s.kind === "change");
    ch.forEach((c, i) => { if (i > 0) expect(c.from).toBe(ch[i - 1].to); });
  });
});
