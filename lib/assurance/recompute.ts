// Re-checks one stored calculation from its own recorded numbers, so an auditor does not have to
// redo the arithmetic by hand. It reads the formula string the engine wrote (see computeCo2e()),
// multiplies the parts again and compares with the stored total. It does not
// look the factor up again: that is a separate check against factors.csv.

export type RecomputeStatus = "matches" | "differs" | "not_checkable";

export interface RecomputeResult {
  status: RecomputeStatus;
  /** Total kg CO2e worked out again from the formula; null when it could not be read. */
  recomputed: number | null;
  stored: number;
  note: string;
}

// "A unit × F kg CO2e/unit = T kg CO2e" (scalar) or "CO2: A × F = T kg; CH4: A × F × GWP (GWP) = T kg CO2e; ..." (per gas).
const SCALAR = /^\s*(-?[\d.eE+]+)\s+\S+\s+×\s+(-?[\d.eE+]+)\s+kg CO2e\/\S+\s+=\s+(-?[\d.eE+]+)\s+kg CO2e\s*$/;
const GAS = /^\s*(CO2|CH4|N2O):\s*(-?[\d.eE+]+)\s+×\s+(-?[\d.eE+]+)(?:\s+×\s+(-?[\d.eE+]+)\s+\(GWP\))?\s+=\s+(-?[\d.eE+]+)\s+kg/;

// The engine prints six decimals, so allow that rounding and a hundredth of a part in a thousand.
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-5, Math.abs(b) * 1e-4);

export function recomputeFromFormula(input: { formula: string; normalizedAmount: number; totalCo2e: number }): RecomputeResult {
  const { formula, normalizedAmount, totalCo2e } = input;
  const unreadable = (note: string): RecomputeResult => ({ status: "not_checkable", recomputed: null, stored: totalCo2e, note });

  let amount: number;
  let recomputed: number;
  const scalar = SCALAR.exec(formula);
  if (scalar) {
    amount = Number(scalar[1]);
    recomputed = amount * Number(scalar[2]);
    if (!close(recomputed, Number(scalar[3]))) return { status: "differs", recomputed, stored: totalCo2e, note: "The formula's own product does not equal its stated result." };
  } else {
    const parts = formula.split(";").map((p) => GAS.exec(p));
    if (!formula.trim() || parts.some((p) => !p)) return unreadable("The formula is in a form this check does not read; recompute by hand.");
    recomputed = 0;
    amount = Number(parts[0]![2]);
    for (const p of parts as RegExpExecArray[]) {
      const own = Number(p[2]) * Number(p[3]) * (p[4] ? Number(p[4]) : 1);
      if (!close(own, Number(p[5]))) return { status: "differs", recomputed: null, stored: totalCo2e, note: `The ${p[1]} line's product does not equal its stated result.` };
      recomputed += own;
    }
  }
  if (!close(recomputed, totalCo2e)) return { status: "differs", recomputed, stored: totalCo2e, note: "The recomputed total is not the stored total." };
  // The formula uses the amount in the factor's own unit and, for spend, after price deflation, so it
  // may legitimately differ from the stored normalised amount; say so rather than call it a fault.
  const adjusted = !close(amount, normalizedAmount);
  return {
    status: "matches",
    recomputed,
    stored: totalCo2e,
    note: adjusted
      ? "Amount × factor agrees with the stored total. The formula's amount differs from the normalised amount (converted to the factor's unit or deflated): check that step against the record."
      : "Amount × factor agrees with the stored total.",
  };
}
