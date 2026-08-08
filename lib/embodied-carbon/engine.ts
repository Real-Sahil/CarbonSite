// Embodied carbon engine — pure functions, deterministic, testable.
// References: ICE Database v3.0, BS EN 15978:2011 lifecycle stages.
// GWP values in kgCO2e per declared unit (default: per kg).

export type LifecycleStage = "A1-A3" | "A4" | "A5" | "C1-C4" | "D";

export interface MaterialGwpFactors {
  gwpA1A3: number;
  gwpA4?: number | null;
  gwpA5?: number | null;
  gwpC1C4?: number | null;
  gwpD?: number | null;
  declaredUnit: string; // "kg" | "m3" | "m2"
  density?: number | null; // kg/m3 — required when declaredUnit="m3"
}

export interface EmbodiedCarbonInput {
  quantity: number;
  unit: string; // "kg" | "tonne" | "m3" | "m2"
  factors: MaterialGwpFactors;
  stages?: LifecycleStage[]; // defaults to ["A1-A3"]
}

export interface EmbodiedCarbonResult {
  quantityKg: number;         // quantity normalised to kg (or original if m2)
  gwpA1A3Used: number;
  gwpA4Used: number | null;
  totalKgCo2e: number;
  breakdown: Record<LifecycleStage, number>;
  formula: string;
  warnings: string[];
}

/** Normalise quantity to the material's declared unit. */
function normaliseQuantity(
  quantity: number,
  inputUnit: string,
  declaredUnit: string,
  density: number | null | undefined,
  warnings: string[],
): number {
  const input = inputUnit.toLowerCase();
  const declared = declaredUnit.toLowerCase();

  // Already matching
  if (input === declared) return quantity;

  // Mass conversions
  if (declared === "kg") {
    if (input === "tonne" || input === "t") return quantity * 1000;
    if (input === "g") return quantity / 1000;
    if (input === "m3") {
      if (!density) {
        warnings.push(`No density set for m3→kg conversion; using quantity as-is`);
        return quantity;
      }
      return quantity * density;
    }
  }

  if (declared === "m3") {
    if (input === "kg" && density) return quantity / density;
    if (input === "tonne" && density) return (quantity * 1000) / density;
  }

  if (declared === "m2") {
    if (input === "m2") return quantity;
    warnings.push(`Cannot convert ${inputUnit} → ${declaredUnit}; using quantity as-is`);
    return quantity;
  }

  warnings.push(`Unknown unit conversion ${inputUnit} → ${declaredUnit}; using quantity as-is`);
  return quantity;
}

export function calculateEmbodiedCarbon(input: EmbodiedCarbonInput): EmbodiedCarbonResult {
  const warnings: string[] = [];
  const stages = input.stages ?? ["A1-A3"];
  const { factors } = input;

  const normalisedQty = normaliseQuantity(
    input.quantity,
    input.unit,
    factors.declaredUnit,
    factors.density,
    warnings,
  );

  const breakdown: Partial<Record<LifecycleStage, number>> = {};

  if (stages.includes("A1-A3")) {
    breakdown["A1-A3"] = normalisedQty * factors.gwpA1A3;
  }
  if (stages.includes("A4")) {
    if (factors.gwpA4 != null) {
      breakdown["A4"] = normalisedQty * factors.gwpA4;
    } else {
      warnings.push("A4 transport factor not available; excluded from total");
    }
  }
  if (stages.includes("A5")) {
    if (factors.gwpA5 != null) {
      breakdown["A5"] = normalisedQty * factors.gwpA5;
    } else {
      warnings.push("A5 installation factor not available; excluded from total");
    }
  }
  if (stages.includes("C1-C4")) {
    if (factors.gwpC1C4 != null) {
      breakdown["C1-C4"] = normalisedQty * factors.gwpC1C4;
    } else {
      warnings.push("C1-C4 end-of-life factor not available; excluded from total");
    }
  }
  if (stages.includes("D")) {
    if (factors.gwpD != null) {
      breakdown["D"] = normalisedQty * factors.gwpD;
    } else {
      warnings.push("D (beyond system boundary) factor not available; excluded from total");
    }
  }

  const totalKgCo2e = Object.values(breakdown).reduce((s, v) => s + v, 0);

  const parts = Object.entries(breakdown).map(
    ([stage, val]) => `${stage}: ${normalisedQty.toFixed(4)} × ${factors[`gwp${stage.replace("-", "")}` as never] ?? "?"} = ${val.toFixed(4)} kgCO2e`,
  );
  const formula = parts.join("; ") + ` → total ${totalKgCo2e.toFixed(4)} kgCO2e`;

  return {
    quantityKg: normalisedQty,
    gwpA1A3Used: factors.gwpA1A3,
    gwpA4Used: factors.gwpA4 ?? null,
    totalKgCo2e,
    breakdown: breakdown as Record<LifecycleStage, number>,
    formula,
    warnings,
  };
}

/** Sum embodied carbon across multiple results (e.g. all materials on a project). */
export function sumEmbodiedCarbon(results: EmbodiedCarbonResult[]): number {
  return results.reduce((s, r) => s + r.totalKgCo2e, 0);
}
