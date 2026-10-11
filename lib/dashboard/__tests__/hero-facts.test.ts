import { describe, expect, it } from "vitest";
import { biggestMover, heroFacts } from "../hero-facts";
import type { WaterfallStep } from "@/lib/charts/waterfall";

const format = (kg: number) => `${(kg / 1000).toFixed(0)} tCO₂e`;

const steps: WaterfallStep[] = [
  { id: "start", label: "Q2", kind: "total", value: 1236000, from: 0, to: 1236000 },
  { id: "pg", label: "Purchased goods", kind: "change", value: -38000, from: 1236000, to: 1198000 },
  { id: "fd", label: "Fleet diesel", kind: "change", value: -21000, from: 1198000, to: 1177000 },
  { id: "other", label: "All other categories", kind: "change", value: 90000, from: 1177000, to: 1267000 },
  { id: "end", label: "Q3", kind: "total", value: 1184000, from: 0, to: 1184000 },
];

const bold = (segments: { text: string; emphasis?: boolean }[]) => segments.filter((s) => s.emphasis).map((s) => s.text);

describe("biggestMover", () => {
  it("picks the largest change by absolute value and never the roll-up", () => {
    expect(biggestMover(steps)?.id).toBe("pg");
  });

  it("returns null when nothing moved", () => {
    expect(biggestMover([steps[0], steps[steps.length - 1]])).toBeNull();
  });
});

describe("heroFacts", () => {
  it("states total, change and biggest fall with the previous period named", () => {
    const facts = heroFacts({ periodLabel: "Q3 2026", totalKg: 1184000, priorLabel: "Q2 2026", deltaPct: -4.2, steps }, format);
    expect(facts.eyebrow).toBe("Q3 2026 · vs Q2 2026");
    expect(facts.headline.map((s) => s.text).join("")).toBe("Q3 2026: 1184 tCO₂e, down 4.2% on Q2 2026.");
    expect(bold(facts.headline)).toEqual(["1184 tCO₂e", "4.2%"]);
    expect(facts.text).toContain("Biggest fall: Purchased goods, −38 tCO₂e.");
    expect(bold(facts.standfirst)).toContain("−38 tCO₂e");
  });

  it("emphasises the total and the percentage in the headline", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000000, priorLabel: "Q2", deltaPct: 2.345, steps: [] }, format);
    expect(facts.headline.map((s) => s.text).join("")).toBe("Q3: 1000 tCO₂e, up 2.3% on Q2.");
    expect(bold(facts.headline)).toEqual(["1000 tCO₂e", "2.3%"]);
  });

  it("says up and names a rise", () => {
    const rising = steps.map((s) => (s.id === "pg" ? { ...s, value: 38000 } : s));
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000000, priorLabel: "Q2", deltaPct: 2.345, steps: rising }, format);
    expect(facts.text).toContain("Biggest rise: Purchased goods, +38 tCO₂e.");
  });

  it("reports unchanged rather than down 0.0%", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000000, priorLabel: "Q2", deltaPct: 0.02, steps: [] }, format);
    expect(facts.headline.map((s) => s.text).join("")).toBe("Q3: 1000 tCO₂e, unchanged on Q2.");
    expect(bold(facts.headline)).toEqual(["1000 tCO₂e"]);
    expect(facts.standfirst).toEqual([]);
  });

  it("with no earlier period, states the total and says there is nothing to compare", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 500000, priorLabel: null, deltaPct: null, steps: [] }, format);
    expect(facts.eyebrow).toBe("Q3");
    expect(facts.headline.map((s) => s.text).join("")).toBe("Q3: 500 tCO₂e.");
    expect(facts.text).toBe("Q3: 500 tCO₂e. No earlier period to compare yet.");
  });

  it("never claims a comparison when the change is not finite", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 500000, priorLabel: "Q2", deltaPct: Number.NaN, steps: [] }, format);
    expect(facts.headline.map((s) => s.text).join("")).toBe("Q3: 500 tCO₂e.");
    expect(facts.eyebrow).toBe("Q3");
  });

  it("lists the scopes that have figures, in order, with each figure emphasised", () => {
    const facts = heroFacts(
      {
        periodLabel: "Q3",
        totalKg: 1184000,
        priorLabel: null,
        deltaPct: null,
        steps: [],
        scopes: [{ scope: 3, kg: 856000 }, { scope: 1, kg: 186000 }, { scope: 2, kg: 0 }],
      },
      format,
    );
    expect(facts.text).toContain("Scope 1 186 tCO₂e, Scope 3 856 tCO₂e.");
    expect(facts.text).not.toContain("Scope 2");
    expect(bold(facts.standfirst)).toEqual(["186 tCO₂e", "856 tCO₂e"]);
  });

  it("counts open review tasks with singular and plural wording", () => {
    const one = heroFacts({ periodLabel: "Q3", totalKg: 1000, priorLabel: null, deltaPct: null, steps: [], openReviewTasks: 1 }, format);
    expect(one.text).toContain("1 review task is open.");
    const many = heroFacts({ periodLabel: "Q3", totalKg: 1000, priorLabel: null, deltaPct: null, steps: [], openReviewTasks: 4 }, format);
    expect(many.text).toContain("4 review tasks are open.");
    expect(bold(many.standfirst)).toEqual(["4"]);
  });

  it("says nothing about open tasks when there are none", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000, priorLabel: "Q2", deltaPct: 1, steps: [], openReviewTasks: 0 }, format);
    expect(facts.text).not.toContain("review task");
  });
});
