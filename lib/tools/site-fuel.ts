// Factors for the public site fuel calculator (/tools/site-fuel-emissions-calculator).
// Each value is copied from the DESNZ 2026 conversion factors (flat file v1.2, revised
// July 2026) as loaded in prisma/data/defra-2026-factors.json; the test beside this file
// fails if the two drift apart. kg CO2e per litre, direct (Scope 1) combustion only.

export const FUEL_FACTOR_SET = {
  name: "DESNZ GHG conversion factors 2026",
  version: "flat file v1.2, revised July 2026",
  licence: "Open Government Licence v3.0",
  sourceUrl: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
} as const;

export type SiteFuel = {
  id: string;
  label: string;
  /** Id of the matching row in prisma/data/defra-2026-factors.json. */
  externalId: string;
  kgCo2ePerLitre: number;
  /** Where it is burnt on a typical site, shown under the selector. */
  use: string;
};

export const SITE_FUELS: readonly SiteFuel[] = [
  { id: "diesel", label: "Diesel, average biofuel blend", externalId: "defra-2026-diesel-litre", kgCo2ePerLitre: 2.58354, use: "Road diesel in vans, cars and site vehicles." },
  { id: "gas-oil", label: "Gas oil (red diesel)", externalId: "defra-2026-gasoil-litre", kgCo2ePerLitre: 2.75541, use: "Off-road plant, generators, dumpers and lighting towers." },
  { id: "diesel-mineral", label: "Diesel, 100% mineral (stationary)", externalId: "defra-2026-diesel-stationary-litre", kgCo2ePerLitre: 2.66155, use: "Stationary generators running on pure mineral diesel." },
  { id: "petrol", label: "Petrol, average biofuel blend", externalId: "defra-2026-petrol-litre", kgCo2ePerLitre: 2.075, use: "Small plant, pumps, breakers and petrol vehicles." },
  { id: "lpg", label: "LPG", externalId: "defra-2026-lpg-litre", kgCo2ePerLitre: 1.55713, use: "Cabin heaters and forklifts on bottled gas." },
  { id: "burning-oil", label: "Burning oil (kerosene)", externalId: "defra-2026-burning-oil-litre", kgCo2ePerLitre: 2.54016, use: "Space heaters and heating oil." },
  { id: "fuel-oil", label: "Fuel oil", externalId: "defra-2026-heavyfueloil-litre", kgCo2ePerLitre: 3.17492, use: "Heavy fuel oil boilers." },
  { id: "hvo", label: "HVO", externalId: "defra-2026-hvo-litre", kgCo2ePerLitre: 0.03558, use: "Renewable diesel. Its biogenic CO2 is reported outside the scopes, not in this total." },
] as const;

export function fuelById(id: string): SiteFuel | undefined {
  return SITE_FUELS.find((f) => f.id === id);
}

/** Tonnes CO2e for a quantity of fuel; a missing, negative or non-finite quantity counts as zero. */
export function fuelTonnes(litres: number, fuel: SiteFuel): number {
  if (!Number.isFinite(litres) || litres <= 0) return 0;
  return (litres * fuel.kgCo2ePerLitre) / 1000;
}
