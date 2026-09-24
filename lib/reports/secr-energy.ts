import { scope2MethodOf } from "@/lib/calculation/scope2-method";
import { hvoShare } from "@/lib/calculation/fuels";
import type { CalculationRow } from "./aggregation";

/// Gross calorific value per litre, in kWh, for the liquid and liquefied fuels
/// a SECR energy total meets most often. Each is the ratio of DESNZ's 2025
/// flat-file "Fuels" factors per litre and per kWh (Gross CV) for the same
/// fuel, so it matches the energy basis DESNZ publishes. SECR asks for energy
/// on a gross calorific basis.
const GROSS_KWH_PER_LITRE: { match: RegExp; kwh: number; label: string }[] = [
  { match: /gas ?oil|red diesel|marine gas oil/i, kwh: 10.7423, label: "Gas oil" },
  { match: /burning oil|kerosene|heating oil/i, kwh: 10.2936, label: "Burning oil" },
  { match: /fuel oil/i, kwh: 11.841, label: "Fuel oil" },
  { match: /petrol|gasoline/i, kwh: 9.4241, label: "Petrol (average biofuel blend)" },
  { match: /lpg|autogas/i, kwh: 7.2593, label: "LPG" },
  { match: /propane/i, kwh: 7.2096, label: "Propane" },
  { match: /butane/i, kwh: 7.8474, label: "Butane" },
  { match: /diesel|derv/i, kwh: 10.5314, label: "Diesel (average biofuel blend)" },
];

export type SecrEnergy = {
  gasKwh: number;
  electricityKwh: number;
  transportFuelKwh: number;
  totalKwh: number;
  /// Records whose quantity could not be expressed in kWh (unknown fuel,
  /// tonnes, HVO), left out of the energy figures but still in the emissions.
  unconverted: number;
};

function litresToKwh(fuelType: string | null | undefined): number | null {
  if (!fuelType) return null;
  // HVO's calorific value is not in the DESNZ fuels table used above.
  if ((hvoShare(fuelType) ?? 0) > 0) return null;
  return GROSS_KWH_PER_LITRE.find((f) => f.match.test(fuelType))?.kwh ?? null;
}

/// Energy consumption for a SECR disclosure, from the run's own calculations:
/// Scope 1 stationary fuel and purchased heat, Scope 2 electricity (one method
/// only, so an organisation recording both methods is not counted twice) and
/// Scope 1 mobile fuel. Quantities are the calculation's normalised amount.
export function secrEnergyFromCalculations(calcs: CalculationRow[]): SecrEnergy {
  const out: SecrEnergy = { gasKwh: 0, electricityKwh: 0, transportFuelKwh: 0, totalKwh: 0, unconverted: 0 };
  let lbKwh = 0;
  let mbKwh = 0;

  for (const c of calcs) {
    const record = c.activityRecord;
    const code = record.emissionCategory.code;
    const unit = c.normalizedUnit;
    const amount = Number(c.normalizedAmount);
    const toKwh = () => (unit === "kWh" ? amount : unit === "litre" ? (litresToKwh(record.fuelType) ?? NaN) * amount : NaN);

    if (code === "s1-stationary" || code === "s2-heat") {
      const kwh = toKwh();
      if (Number.isFinite(kwh)) out.gasKwh += kwh;
      else out.unconverted++;
    } else if (code === "s1-mobile") {
      const kwh = toKwh();
      if (Number.isFinite(kwh)) out.transportFuelKwh += kwh;
      else out.unconverted++;
    } else if (record.emissionCategory.scope === 2) {
      if (unit !== "kWh") {
        out.unconverted++;
        continue;
      }
      if (scope2MethodOf(record) === "market_based") mbKwh += amount;
      else lbKwh += amount;
    }
  }

  out.electricityKwh = lbKwh > 0 ? lbKwh : mbKwh;
  out.totalKwh = out.gasKwh + out.electricityKwh + out.transportFuelKwh;
  return out;
}
