// Calculation engine — deterministic, heavily tested, traceable at record level.
// CO2e = normalized_amount × factor_value
// For gas-specific: CO2e = CO2 + (CH4 × CH4_GWP) + (N2O × N2O_GWP)

import { Decimal } from "@prisma/client/runtime/library";

// AR6 GWP values (100-year)
const GWP = { CH4: 27.9, N2O: 273 };

export type GasValues = {
  co2?: number | null;
  ch4?: number | null;
  n2o?: number | null;
  co2e?: number | null;
};

export type CalculationResult = {
  co2: number | null;
  ch4: number | null;
  n2o: number | null;
  totalCo2e: number;
  formula: string;
  warnings: string[];
};

export function computeCo2e(
  normalizedAmount: number,
  normalizedUnit: string,
  factor: GasValues,
  factorUnit: string,
  warnings: string[] = [],
): CalculationResult {
  if (normalizedUnit !== factorUnit) {
    warnings.push(`Unit mismatch: activity ${normalizedUnit} vs factor ${factorUnit}`);
  }

  // If factor has gas breakdown, compute per-gas
  if (factor.co2 != null || factor.ch4 != null || factor.n2o != null) {
    const co2 = factor.co2 != null ? normalizedAmount * Number(factor.co2) : null;
    const ch4 = factor.ch4 != null ? normalizedAmount * Number(factor.ch4) : null;
    const n2o = factor.n2o != null ? normalizedAmount * Number(factor.n2o) : null;
    const totalCo2e =
      (co2 ?? 0) + (ch4 != null ? ch4 * GWP.CH4 : 0) + (n2o != null ? n2o * GWP.N2O : 0);

    const formula = [
      co2 != null ? `CO2: ${normalizedAmount} × ${factor.co2} = ${co2.toFixed(6)} kg` : null,
      ch4 != null ? `CH4: ${normalizedAmount} × ${factor.ch4} × ${GWP.CH4} (GWP) = ${(ch4 * GWP.CH4).toFixed(6)} kg CO2e` : null,
      n2o != null ? `N2O: ${normalizedAmount} × ${factor.n2o} × ${GWP.N2O} (GWP) = ${(n2o * GWP.N2O).toFixed(6)} kg CO2e` : null,
    ]
      .filter(Boolean)
      .join("; ");

    return { co2, ch4, n2o, totalCo2e, formula, warnings };
  }

  // Scalar CO2e factor
  if (factor.co2e != null) {
    const totalCo2e = normalizedAmount * Number(factor.co2e);
    const formula = `${normalizedAmount} ${normalizedUnit} × ${factor.co2e} kg CO2e/${factorUnit} = ${totalCo2e.toFixed(6)} kg CO2e`;
    return { co2: null, ch4: null, n2o: null, totalCo2e, formula, warnings };
  }

  throw new Error("Emission factor has no usable values (co2e, co2, ch4, n2o all null)");
}

export function toDecimal(n: number | null): Decimal | null {
  return n != null ? new Decimal(n) : null;
}
