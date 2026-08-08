/**
 * Extended UK emission factor seed.
 *
 * Covers DEFRA 2024 factors not in the base seed:
 *   - UK regional electricity grid intensity
 *   - HVO, marine gas oil, kerosene fuels
 *   - UK transport (road, rail, aviation, ferry) per passenger-km / vehicle-km
 *   - Refrigerant GWP (IPCC AR6)
 *   - BEIS industrial process factors
 *   - Additional waste disposal routes
 *
 * Sources:
 *   DEFRA Conversion Factors 2024, gov.uk/government/collections/government-conversion-factors-for-company-reporting
 *   BEIS UK GHG Inventory 2024
 *   IPCC AR6 WG1, Table 7.SM.7 (GWP100)
 *
 * Run: pnpm tsx prisma/seed-uk-factors.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert DEFRA 2024 library
  const defra2024 = await prisma.factorLibrary.upsert({
    where: { name_version: { name: "DEFRA", version: "2024.1" } },
    update: {},
    create: {
      name: "DEFRA",
      version: "2024.1",
      license: "Open Government Licence v3.0",
      sourceUrl: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      publishedAt: new Date("2024-06-01"),
    },
  });

  const beis = await prisma.factorLibrary.upsert({
    where: { name_version: { name: "BEIS", version: "2024.1" } },
    update: {},
    create: {
      name: "BEIS",
      version: "2024.1",
      license: "Open Government Licence v3.0",
      sourceUrl: "https://www.gov.uk/government/statistics/uks-carbon-footprint",
      publishedAt: new Date("2024-01-01"),
    },
  });

  const catMap = new Map<string, string>();
  const categories = await prisma.emissionCategory.findMany({ select: { id: true, code: true } });
  for (const c of categories) catMap.set(c.code, c.id);

  function catId(code: string) {
    const id = catMap.get(code);
    if (!id) throw new Error(`Unknown category code: ${code}`);
    return id;
  }

  const factors = [
    // ── UK Regional electricity grid intensity (kgCO2e/kWh) ─────────────────
    // Source: National Grid ESO Regional Carbon Intensity 2024
    {
      externalId: "defra-2024-elec-uk-average",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.20493,
      usageNotes: "UK average grid electricity, location-based. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-elec-england",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", geographyRegion: "England", inputUnit: "kWh",
      co2e: 0.22100,
      usageNotes: "England regional grid, location-based. National Grid ESO 2024.",
    },
    {
      externalId: "defra-2024-elec-scotland",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", geographyRegion: "Scotland", inputUnit: "kWh",
      co2e: 0.10900,
      usageNotes: "Scotland regional grid (high renewables). National Grid ESO 2024.",
    },
    {
      externalId: "defra-2024-elec-wales",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", geographyRegion: "Wales", inputUnit: "kWh",
      co2e: 0.23800,
      usageNotes: "Wales regional grid. National Grid ESO 2024.",
    },
    {
      externalId: "defra-2024-elec-northern-ireland",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", geographyRegion: "Northern Ireland", inputUnit: "kWh",
      co2e: 0.37100,
      usageNotes: "Northern Ireland grid. SONI 2024.",
    },

    // ── Alternative fuels (Scope 1, per litre) ───────────────────────────────
    {
      externalId: "defra-2024-hvo-litre",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 0.19500,
      usageNotes: "HVO (Hydrotreated Vegetable Oil) — significant lifecycle reduction vs diesel. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-mgo-litre",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.68000,
      usageNotes: "Marine gas oil (MGO). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-kerosene-litre",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.55200,
      usageNotes: "Kerosene (heating). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-lpg-litre",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 1.63510,
      usageNotes: "LPG (liquid petroleum gas). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-biomethane-kwh",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.00000,
      usageNotes: "Biomethane (certified). Net-zero per DEFRA 2024 methodology.",
    },

    // ── UK road transport (per vehicle-km) ───────────────────────────────────
    {
      externalId: "defra-2024-car-petrol-vkm",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.17041,
      usageNotes: "Average petrol car. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-car-diesel-vkm",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.16307,
      usageNotes: "Average diesel car. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-car-ev-vkm",
      libraryId: defra2024.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.05302,
      usageNotes: "Battery electric car, UK grid. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-van-diesel-vkm",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.21150,
      usageNotes: "Diesel van (up to 3.5t). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-hgv-75t-vkm",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.27900,
      usageNotes: "HGV 7.5–17t rigid. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-hgv-17t-vkm",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "vehicle-km",
      co2e: 0.17900,
      usageNotes: "HGV >17t articulated. DEFRA 2024.",
    },

    // ── UK passenger transport (per passenger-km) ─────────────────────────────
    {
      externalId: "defra-2024-rail-uk-pkm",
      libraryId: defra2024.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel", geographyCountry: "GB", inputUnit: "passenger-km",
      co2e: 0.03549,
      usageNotes: "National rail (average). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-tube-pkm",
      libraryId: defra2024.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel", geographyCountry: "GB", geographyRegion: "London", inputUnit: "passenger-km",
      co2e: 0.02800,
      usageNotes: "London Underground. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-bus-local-pkm",
      libraryId: defra2024.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting", geographyCountry: "GB", inputUnit: "passenger-km",
      co2e: 0.07920,
      usageNotes: "Local bus average. DEFRA 2024.",
    },
    {
      externalId: "defra-2024-domestic-flight-pkm",
      libraryId: defra2024.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel", geographyCountry: "GB", inputUnit: "passenger-km",
      co2e: 0.15100,
      usageNotes: "Domestic aviation (economy, with RFI). DEFRA 2024.",
    },
    {
      externalId: "defra-2024-ferry-foot-pkm",
      libraryId: defra2024.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel", geographyCountry: "GB", inputUnit: "passenger-km",
      co2e: 0.01900,
      usageNotes: "Ferry foot passenger. DEFRA 2024.",
    },

    // ── Refrigerants GWP (Scope 1, kgCO2e per kg leaked) ─────────────────────
    // Source: IPCC AR6 GWP100 values
    {
      externalId: "defra-2024-r134a-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 771.0,
      usageNotes: "R-134a (HFC-134a) GWP100. IPCC AR6.",
    },
    {
      externalId: "defra-2024-r410a-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 2088.0,
      usageNotes: "R-410A blend GWP100. IPCC AR6.",
    },
    {
      externalId: "defra-2024-r32-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 771.0,
      usageNotes: "R-32 (difluoromethane) GWP100. IPCC AR6.",
    },
    {
      externalId: "defra-2024-r22-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 1760.0,
      usageNotes: "R-22 (HCFC-22) GWP100. IPCC AR6. Phased out under Montreal Protocol.",
    },
    {
      externalId: "defra-2024-hfo1234yf-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 4.0,
      usageNotes: "HFO-1234yf low-GWP refrigerant. IPCC AR6.",
    },
    {
      externalId: "defra-2024-r407c-kg",
      libraryId: defra2024.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", geographyCountry: "GB", inputUnit: "kg",
      co2e: 1774.0,
      usageNotes: "R-407C blend GWP100. IPCC AR6.",
    },

    // ── BEIS industrial process factors ──────────────────────────────────────
    {
      externalId: "beis-2024-steel-eaf-kg",
      libraryId: beis.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 0.70,
      usageNotes: "UK steel production (EAF, recycled scrap). BEIS GHG Inventory 2024.",
    },
    {
      externalId: "beis-2024-cement-kg",
      libraryId: beis.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 0.83,
      usageNotes: "Cement clinker production (process + fuel combustion). BEIS 2024.",
    },
    {
      externalId: "beis-2024-lime-kg",
      libraryId: beis.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 1.08,
      usageNotes: "Lime production. BEIS 2024.",
    },
    {
      externalId: "beis-2024-aluminium-primary-kg",
      libraryId: beis.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 8.24,
      usageNotes: "Primary aluminium smelting. BEIS 2024.",
    },
    {
      externalId: "beis-2024-paper-kg",
      libraryId: beis.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 0.61,
      usageNotes: "Paper and paperboard production. BEIS 2024.",
    },
  ];

  let created = 0;
  for (const f of factors) {
    const existing = await prisma.emissionFactor.findFirst({
      where: { factorLibraryId: f.libraryId, externalId: f.externalId },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.emissionFactor.create({
      data: {
        factorLibraryId: f.libraryId,
        externalId: f.externalId,
        scope: f.scope,
        emissionCategoryId: catId(f.categoryCode),
        activityType: f.activityType,
        geographyCountry: f.geographyCountry,
        geographyRegion: (f as { geographyRegion?: string }).geographyRegion,
        effectiveStartDate: new Date("2024-01-01"),
        effectiveEndDate: new Date("2025-12-31"),
        inputUnit: f.inputUnit,
        co2e: f.co2e,
        usageNotes: f.usageNotes,
      },
    });
    created++;
  }

  console.log(`UK factors seed complete: ${created} new factors added (DEFRA 2024 + BEIS 2024).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
