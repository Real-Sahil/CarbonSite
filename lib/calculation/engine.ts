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
  /** Biogenic CO2, kg per input unit. Never added into co2/co2e/totalCo2e. */
  biogenicCo2?: number | null;
};

export type CalculationResult = {
  co2: number | null;
  ch4: number | null;
  n2o: number | null;
  totalCo2e: number;
  /// GHG Protocol convention: biogenic CO2 (combustion of biomass, biofuel,
  /// biogenic waste) is reported as a separate memo item and never netted
  /// into totalCo2e or any fossil scope total.
  biogenicCo2e: number | null;
  formula: string;
  warnings: string[];
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
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

  const biogenicCo2e =
    factor.biogenicCo2 != null ? normalizedAmount * Number(factor.biogenicCo2) : null;

  // Use the per-gas branch when any individual gas value is present, UNLESS
  // co2e is also populated and the gas set is incomplete. In that case, co2e
  // is the authoritative GWP-weighted total (it already includes the
  // contributions of gases not individually broken out), so the scalar path
  // is more accurate. Example: co2=2.02, co2e=2.23 — the 0.21 difference is
  // the embedded CH4+N2O GWP; entering the gas branch would discard it.
  const hasAnyGas = factor.co2 != null || factor.ch4 != null || factor.n2o != null;
  const hasAllGases = factor.co2 != null && factor.ch4 != null && factor.n2o != null;
  if (hasAnyGas && (hasAllGases || factor.co2e == null)) {
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

    return { co2, ch4, n2o, totalCo2e, biogenicCo2e, formula, warnings };
  }

  // Scalar CO2e factor
  if (factor.co2e != null) {
    const totalCo2e = normalizedAmount * Number(factor.co2e);
    const formula = `${normalizedAmount} ${normalizedUnit} × ${factor.co2e} kg CO2e/${factorUnit} = ${totalCo2e.toFixed(6)} kg CO2e`;
    return { co2: null, ch4: null, n2o: null, totalCo2e, biogenicCo2e, formula, warnings };
  }

  throw new Error("Emission factor has no usable values (co2e, co2, ch4, n2o all null)");
}

export function toDecimal(n: number | null): Decimal | null {
  return n != null ? new Decimal(n) : null;
}
