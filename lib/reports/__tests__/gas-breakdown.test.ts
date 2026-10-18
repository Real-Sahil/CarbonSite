// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/storage", () => ({ getObject: vi.fn() }));
vi.mock("@/lib/logger", () => ({ reportLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { aggregate, co2eBreakdownKg, type CalculationRow } from "@/lib/reports/aggregation";

const calc = (totalCo2e: number, gas: { co2?: number; ch4?: number; n2o?: number } = {}) =>
  ({
    totalCo2e,
    co2: gas.co2 ?? null,
    ch4: gas.ch4 ?? null,
    n2o: gas.n2o ?? null,
    biogenicCo2e: null,
    activityRecord: {
      scope2Method: null,
      emissionCategory: { code: "s1-stationary", name: "Stationary combustion", scope: 1 },
      facility: null,
    },
  }) as unknown as CalculationRow;

// Per-gas path: 1000 kg CO2 + 10 kg CH4 × 27.9 + 1 kg N2O × 273 = 1552 kg CO2e.
const perGas = calc(1552, { co2: 1000, ch4: 10, n2o: 1 });

describe("per-gas breakdown of the headline total", () => {
  it("weights methane and nitrous oxide to CO2e, so the parts sum to the total", () => {
    const agg = aggregate([perGas, calc(500, { co2: 500, ch4: 0, n2o: 0 })]);
    const parts = co2eBreakdownKg(agg);
    expect(parts.co2Kg).toBeCloseTo(1500, 6);
    expect(parts.ch4Kg).toBeCloseTo(279, 6);
    expect(parts.n2oKg).toBeCloseTo(273, 6);
    expect(parts.unsplitKg).toBeUndefined();
    expect((parts.co2Kg ?? 0) + (parts.ch4Kg ?? 0) + (parts.n2oKg ?? 0)).toBeCloseTo(agg.grandKg, 6);
  });

  it("keeps a total-only factor as its own row, so a mixed run still adds up", () => {
    const agg = aggregate([perGas, calc(800)]);
    const parts = co2eBreakdownKg(agg);
    expect(parts.unsplitKg).toBeCloseTo(800, 6);
    const sum = (parts.co2Kg ?? 0) + (parts.ch4Kg ?? 0) + (parts.n2oKg ?? 0) + (parts.unsplitKg ?? 0);
    expect(sum).toBeCloseTo(agg.grandKg, 6);
  });
});
