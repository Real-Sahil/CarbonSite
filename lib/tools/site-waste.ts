// Factors for the public site waste calculator (/tools/site-waste-emissions-calculator).
// Each value is copied from the DESNZ 2026 conversion factors (flat file v1.2) as loaded in
// prisma/data/defra-2026-factors.json; the test beside this file fails if the two drift apart.
// kg CO2e per tonne of waste, disposal or treatment only (no transport to the facility).

export { FUEL_FACTOR_SET as WASTE_FACTOR_SET } from "@/lib/tools/site-fuel";

export type SiteWaste = {
  id: string;
  label: string;
  /** Id of the matching row in prisma/data/defra-2026-factors.json. */
  externalId: string;
  kgCo2ePerTonne: number;
  /** What the factor covers, shown under the selector. */
  covers: string;
};

export const SITE_WASTES: readonly SiteWaste[] = [
  { id: "mixed-landfill", label: "Mixed waste to landfill", externalId: "defra-2026-waste-mixed-landfill", kgCo2ePerTonne: 520.58023, covers: "Commercial and industrial waste sent to landfill, such as general skip waste." },
  { id: "wood-landfill", label: "Wood to landfill", externalId: "defra-2026-waste-wood-landfill", kgCo2ePerTonne: 925.36725, covers: "Construction wood waste sent to landfill." },
  { id: "inert-landfill", label: "Inert waste to landfill", externalId: "defra-2026-waste-inert-landfill", kgCo2ePerTonne: 1.27043, covers: "Inert construction waste such as aggregates, bricks and concrete." },
  { id: "efw", label: "Mixed waste to energy from waste", externalId: "defra-2026-waste-efw-incineration", kgCo2ePerTonne: 4.65358, covers: "Commercial and industrial waste burnt with energy recovery." },
  { id: "recycled", label: "Mixed waste recycled", externalId: "defra-2026-waste-mixed-recycling", kgCo2ePerTonne: 4.65358, covers: "Commercial and industrial waste in closed-loop recycling." },
] as const;

export function wasteById(id: string): SiteWaste | undefined {
  return SITE_WASTES.find((w) => w.id === id);
}

/** Tonnes CO2e for a tonnage of waste; a missing, negative or non-finite quantity counts as zero. */
export function wasteTonnes(tonnes: number, waste: SiteWaste): number {
  if (!Number.isFinite(tonnes) || tonnes <= 0) return 0;
  return (tonnes * waste.kgCo2ePerTonne) / 1000;
}
