import { computeCo2e, type CalculationResult, type GasValues } from "./engine";
import { normalizeUnit } from "./units";

export type RecordCalculationInput = {
  originalAmount: number;
  originalUnit: string;
  normalizedAmount: number;
  normalizedUnit: string;
  result: CalculationResult;
};

export function computeRecordEmission(
  amount: number,
  unit: string,
  factor: GasValues,
  factorInputUnit: string,
  warnings: string[] = [],
): RecordCalculationInput {
  const normalized = normalizeUnit(amount, unit);
  const result = computeCo2e(
    normalized.amount,
    normalized.unit,
    factor,
    factorInputUnit,
    warnings,
  );

  return {
    originalAmount: amount,
    originalUnit: unit,
    normalizedAmount: normalized.amount,
    normalizedUnit: normalized.unit,
    result,
  };
}
