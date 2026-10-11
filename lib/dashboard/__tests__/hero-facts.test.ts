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
    expect(facts.headline).toBe("Q3 2026: 1184 tCO₂e, down 4.2% on Q2 2026.");
    expect(facts.detail).toBe("Biggest fall: Purchased goods, −38 tCO₂e.");
  });

  it("says up and names a rise", () => {
    const rising = steps.map((s) => (s.id === "pg" ? { ...s, value: 38000 } : s));
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000000, priorLabel: "Q2", deltaPct: 2.345, steps: rising }, format);
    expect(facts.headline).toBe("Q3: 1000 tCO₂e, up 2.3% on Q2.");
    expect(facts.detail).toBe("Biggest rise: Purchased goods, +38 tCO₂e.");
  });

  it("reports unchanged rather than down 0.0%", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 1000000, priorLabel: "Q2", deltaPct: 0.02, steps: [] }, format);
    expect(facts.headline).toBe("Q3: 1000 tCO₂e, unchanged on Q2.");
    expect(facts.detail).toBeNull();
  });

  it("with no earlier period, states the total and says there is nothing to compare", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 500000, priorLabel: null, deltaPct: null, steps: [] }, format);
    expect(facts.headline).toBe("Q3: 500 tCO₂e.");
    expect(facts.detail).toBe("No earlier period to compare yet.");
  });

  it("never claims a comparison when the change is not finite", () => {
    const facts = heroFacts({ periodLabel: "Q3", totalKg: 500000, priorLabel: "Q2", deltaPct: Number.NaN, steps: [] }, format);
    expect(facts.headline).toBe("Q3: 500 tCO₂e.");
  });
});
