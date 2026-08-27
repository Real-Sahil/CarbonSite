// GHG Protocol Scope 1/2/3 Calculation Engine (Direct Implementation)
// No external services, embedded factors, fully self-contained
// Reference: https://ghgprotocol.org (Corporate Accounting & Reporting Standard)

// AR6 GWP Constants (IPCC 2021, 100-year horizon)
export const GWP_AR6 = {
  CH4: 27.9,
  N2O: 273,
  CF4: 6630,
  C2F6: 11100,
  HFC134a: 1526,
  SF6: 25200,
} as const;

// Common Units (normalize all to kg)
export const UNIT_CONVERSION = {
  // Mass
  kg: 1,
  tonne: 1000,
  lb: 0.453592,
  g: 0.001,
  // Volume (fuel)
  litre: 1, // Requires fuel-specific conversion to kg
  m3: 1, // Gas: ~1.23 kg/m³ at STP for natural gas
  gallon_us: 3.78541,
  gallon_uk: 4.54609,
  // Energy
  kWh: 1, // Grid electricity in kWh
  MWh: 1000,
  GJ: 277.778, // To kWh equivalent
  // Distance
  km: 1, // For tonne-km or passenger-km
  mile: 1.60934,
} as const;

// Fuel-specific conversion factors (kg per unit)
export const FUEL_DENSITY = {
  natural_gas_m3: 0.729, // kg per m³ at STP
  natural_gas_therms: 26.95, // kg per therm
  diesel_litre: 0.832, // kg per litre
  petrol_litre: 0.745, // kg per litre
  lpg_litre: 0.51, // kg per litre
  fuel_oil_litre: 0.9, // kg per litre
  coal_tonne: 1000, // kg (usually reported in tonnes)
  biomass_tonne: 1000, // kg
} as const;

// Scope 1: Direct emissions from owned/controlled sources
export type Scope1Category =
  | "stationary_fuel" // On-site combustion (heating, power)
  | "mobile_fuel" // Fleet vehicles, equipment
  | "fugitive" // Refrigerant leaks, methane venting
  | "process"; // Industrial process emissions (cement, steel, chemical)

// Scope 2: Indirect emissions from purchased electricity/steam
export type Scope2Category =
  | "electricity_location_based" // Grid average factor
  | "electricity_market_based" // Purchased green/renewable credits
  | "district_heating" // Purchased steam/hot water
  | "district_cooling";

// Scope 3: Other indirect (15 categories per GHG Protocol)
export type Scope3Category =
  | "purchased_goods_services" // Upstream supply chain
  | "capital_goods" // Equipment/infrastructure
  | "fuel_energy_activities" // Extraction, production of fuels
  | "upstream_transportation" // Supplier to facility
  | "waste_generated" // Treatment of waste produced
  | "business_travel" // Employee flights, hotels, rentals
  | "employee_commuting" // Home to work transportation
  | "downstream_transportation" // Distribution to customers
  | "processing_of_products" // Use of sold products
  | "use_of_products" // Consumer use phase
  | "end_of_life" // Disposal/recycling
  | "leased_assets_upstream" // Upstream from leases
  | "franchises" // Franchisee operations
  | "investments" // Financed operations
  | "leased_assets_downstream"; // Downstream from leases

export type EmissionFactor = {
  id: string;
  externalId?: string;
  scope: 1 | 2 | 3;
  category: Scope1Category | Scope2Category | Scope3Category;
  activityType?: string; // "diesel", "natural_gas", "coal", "market_based", etc.
  inputUnit: keyof typeof UNIT_CONVERSION;
  // Gas breakdown (kg CO2e per unit)
  co2?: number;
  ch4?: number;
  n2o?: number;
  // Scalar factor (alternative to gas breakdown)
  co2e?: number;
  // Geography
  country?: string;
  region?: string;
  // Metadata
  source: "DEFRA_2025" | "EPA_2025" | "Ember" | "ecoinvent" | "Custom";
  effectiveStartDate: Date;
  effectiveEndDate?: Date;
};

export type CalculationInput = {
  amount: number;
  unit: keyof typeof UNIT_CONVERSION;
  category: Scope1Category | Scope2Category | Scope3Category;
  activityType?: string;
  country?: string;
  date: Date;
  // Optional for fuel conversions
  fuelType?: keyof typeof FUEL_DENSITY;
};

export type CalculationResult = {
  totalCo2e: number; // kg CO2e
  co2?: number; // kg CO2
  ch4?: number; // kg CH4 (not CO2e)
  n2o?: number; // kg N2O (not CO2e)
  // Breakdown showing GWP applied
  ch4Co2e?: number; // kg CO2e equivalent (CH4 × 27.9)
  n2oCo2e?: number; // kg CO2e equivalent (N2O × 273)
  formula: string; // Audit trail
  factorId: string; // Which factor was used
  factorSource: string; // DEFRA, EPA, etc.
  warnings: string[];
  confidenceLevel?: "high" | "medium" | "low"; // Based on factor precision
};

// === Core Calculation Engine ===

/**
 * Normalize activity amount to standard unit (kg for mass, kWh for energy)
 * Handles fuel density conversions automatically
 */
export function normalizeAmount(
  amount: number,
  unit: keyof typeof UNIT_CONVERSION,
  fuelType?: keyof typeof FUEL_DENSITY,
): { normalized: number; unit: string; warnings: string[] } {
  const warnings: string[] = [];

  // Unit conversion (distance/volume/mass to base unit)
  const normalized = amount * UNIT_CONVERSION[unit];

  // Fuel conversion (litre/m³ to kg if fuel type specified)
  if (fuelType && (unit === "litre" || unit === "m3")) {
    const density = FUEL_DENSITY[fuelType];
    if (density) {
      return {
        normalized: normalized * density,
        unit: "kg",
        warnings,
      };
    }
  }

  return { normalized, unit, warnings };
}

/**
 * Compute CO2e from activity amount and emission factor
 * Applies GWP (Global Warming Potential) for CH4 and N2O
 */
export function computeCo2e(
  normalizedAmount: number,
  factor: EmissionFactor,
  warnings: string[] = [],
): CalculationResult {
  const result: CalculationResult = {
    totalCo2e: 0,
    formula: "",
    factorId: factor.id,
    factorSource: factor.source,
    warnings: [...warnings],
    confidenceLevel: factor.source === "DEFRA_2025" ? "high" : "medium",
  };

  // Case 1: Gas-specific factors (CO2, CH4, N2O breakdown)
  if (factor.co2 != null || factor.ch4 != null || factor.n2o != null) {
    const co2 = factor.co2 != null ? normalizedAmount * factor.co2 : 0;
    const ch4 = factor.ch4 != null ? normalizedAmount * factor.ch4 : 0;
    const n2o = factor.n2o != null ? normalizedAmount * factor.n2o : 0;

    const ch4Co2e = ch4 * GWP_AR6.CH4;
    const n2oCo2e = n2o * GWP_AR6.N2O;

    result.co2 = co2 || undefined;
    result.ch4 = ch4 || undefined;
    result.n2o = n2o || undefined;
    result.ch4Co2e = ch4Co2e || undefined;
    result.n2oCo2e = n2oCo2e || undefined;
    result.totalCo2e = co2 + ch4Co2e + n2oCo2e;

    const parts = [
      co2 > 0 ? `CO2: ${normalizedAmount} × ${factor.co2} = ${co2.toFixed(4)} kg` : null,
      ch4 > 0
        ? `CH4: ${normalizedAmount} × ${factor.ch4} × ${GWP_AR6.CH4} (GWP) = ${ch4Co2e.toFixed(4)} kg CO2e`
        : null,
      n2o > 0
        ? `N2O: ${normalizedAmount} × ${factor.n2o} × ${GWP_AR6.N2O} (GWP) = ${n2oCo2e.toFixed(4)} kg CO2e`
        : null,
    ].filter(Boolean);

    result.formula = parts.join("; ");
  }
  // Case 2: Scalar CO2e factor (simpler, less precise)
  else if (factor.co2e != null) {
    result.totalCo2e = normalizedAmount * factor.co2e;
    result.formula = `${normalizedAmount} × ${factor.co2e} = ${result.totalCo2e.toFixed(4)} kg CO2e`;
    result.confidenceLevel = "low"; // Scalar factors hide gas breakdown
  } else {
    result.warnings.push("Factor has no usable values (co2, ch4, n2o, co2e all null)");
  }

  return result;
}

/**
 * Calculate Scope 2 dual reporting (location-based vs market-based)
 * Returns both, user chooses which to report
 */
export function calculateScope2DualReporting(
  normalizedAmount: number,
  locationBasedFactor: EmissionFactor,
  marketBasedFactor?: EmissionFactor,
): { locationBased: CalculationResult; marketBased?: CalculationResult } {
  const locationBased = computeCo2e(normalizedAmount, locationBasedFactor, [
    "This is location-based Scope 2 (grid average emission factor)",
  ]);

  const marketBased = marketBasedFactor
    ? computeCo2e(normalizedAmount, marketBasedFactor, [
        "This is market-based Scope 2 (renewable/low-carbon contracts)",
      ])
    : undefined;

  return { locationBased, marketBased };
}

/**
 * Deterministic factor selection with audit trail
 * Priority: exact match > geography > activity type > any scope/category match
 */
export function selectFactor(
  category: Scope1Category | Scope2Category | Scope3Category,
  activityType: string | undefined,
  country: string | undefined,
  factors: EmissionFactor[],
  date: Date,
): { factor: EmissionFactor; reason: string } | null {
  // Filter to factors valid on the activity date
  const validFactors = factors.filter((f) => {
    const startOk = !f.effectiveStartDate || f.effectiveStartDate <= date;
    const endOk = !f.effectiveEndDate || f.effectiveEndDate >= date;
    return startOk && endOk;
  });

  if (validFactors.length === 0) return null;

  // Score candidates
  const scored = validFactors.map((f) => {
    let score = 0;
    const reasons: string[] = [];

    if (f.category === category) {
      score += 10;
      reasons.push(`category match`);
    }

    if (activityType && f.activityType?.toLowerCase() === activityType.toLowerCase()) {
      score += 8;
      reasons.push(`activity type match (${activityType})`);
    }

    if (country && f.country === country) {
      score += 6;
      reasons.push(`country match (${country})`);
    } else if (!f.country) {
      score += 2;
      reasons.push("global factor");
    }

    if (f.source === "DEFRA_2025" || f.source === "EPA_2025") {
      score += 3;
      reasons.push(`authoritative source (${f.source})`);
    }

    return { factor: f, score, reason: reasons.join(", ") };
  });

  // Sort by score (descending) then by factor ID (tie-breaker for determinism)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.factor.externalId || a.factor.id).localeCompare(
      b.factor.externalId || b.factor.id,
    );
  });

  return scored.length > 0 ? { factor: scored[0].factor, reason: scored[0].reason } : null;
}

/**
 * End-to-end calculation: input → normalize → select factor → compute CO2e
 */
export function calculate(
  input: CalculationInput,
  availableFactors: EmissionFactor[],
): CalculationResult | null {
  // Step 1: Normalize amount to standard unit
  const { normalized, warnings } = normalizeAmount(input.amount, input.unit, input.fuelType);

  // Step 2: Filter factors by scope/category
  const categoryFactors = availableFactors.filter((f) => f.category === input.category);

  if (categoryFactors.length === 0) {
    return {
      totalCo2e: 0,
      formula: "",
      factorId: "NOT_FOUND",
      factorSource: "None",
      warnings: [`No factors found for category: ${input.category}`],
    };
  }

  // Step 3: Select best factor
  const selection = selectFactor(input.category, input.activityType, input.country, categoryFactors, input.date);

  if (!selection) {
    return {
      totalCo2e: 0,
      formula: "",
      factorId: "NO_VALID_FACTOR",
      factorSource: "None",
      warnings: [`No valid factor found on ${input.date.toISOString().split("T")[0]}`],
    };
  }

  // Step 4: Compute CO2e
  const result = computeCo2e(normalized, selection.factor, warnings);
  result.warnings.push(`Factor selected: ${selection.reason}`);

  return result;
}
