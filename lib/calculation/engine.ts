// Calculation engine — deterministic, heavily tested, traceable at record level.
// CO2e = normalized_amount × factor_value
// For gas-specific: CO2e = CO2 + (CH4 × CH4_GWP) + (N2O × N2O_GWP)

import { Decimal } from "@prisma/client/runtime/library";
import { GWP_AR6 } from "./gwp";

const GWP = GWP_AR6;

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

  // co2e scalar takes precedence whenever it is set: the factor publisher's
  // pre-computed CO2e already applies the correct GWP for that library
  // (DEFRA 2025 uses AR5; EPA uses AR4/AR5). Computing CO2e ourselves from
  // per-gas values would apply the *code's* GWP (AR6) and diverge from the
  // published figure. Per-gas path is only taken when co2e is absent — i.e.
  // the library only provides gas-level values and we must derive CO2e.
  const hasAnyGas = factor.co2 != null || factor.ch4 != null || factor.n2o != null;
  if (hasAnyGas && factor.co2e == null) {
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
