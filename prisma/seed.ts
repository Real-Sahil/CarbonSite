import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Methodology version — GHG Protocol 2026, GWP AR6
  await prisma.methodologyVersion.upsert({
    where: { name: "ghg-protocol-v2026-01" },
    update: {},
    create: {
      name: "ghg-protocol-v2026-01",
      gwpVersion: "AR6",
      notes: "GHG Protocol Corporate Standard, GWP values from IPCC AR6",
    },
  });

  // Emission categories (MVP scope — seeded globally, no per-org custom categories)
  const categories = [
    { scope: 1, code: "s1-stationary", name: "Stationary Combustion", activityType: "stationary_combustion" },
    { scope: 1, code: "s1-mobile", name: "Mobile Combustion", activityType: "mobile_combustion" },
    { scope: 1, code: "s1-fugitive", name: "Fugitive Emissions (Refrigerants)", activityType: "fugitive_refrigerants" },
    { scope: 2, code: "s2-electricity-lb", name: "Purchased Electricity (Location-Based)", activityType: "purchased_electricity_location" },
    { scope: 2, code: "s2-electricity-mb", name: "Purchased Electricity (Market-Based)", activityType: "purchased_electricity_market" },
    { scope: 3, code: "s3-business-travel", name: "Business Travel", activityType: "business_travel" },
    { scope: 3, code: "s3-commuting", name: "Employee Commuting", activityType: "employee_commuting" },
    { scope: 3, code: "s3-purchased-goods", name: "Purchased Goods & Services", activityType: "purchased_goods_spend" },
    { scope: 3, code: "s3-upstream-transport", name: "Upstream Transportation & Distribution", activityType: "upstream_transport" },
    // GHG Protocol Scope 3 Category 5 — the category field-worker waste
    // tickets are reviewed into. Without it (and mass-based factors below),
    // the platform's flagship capture flow could never be calculated.
    { scope: 3, code: "s3-waste", name: "Waste Generated in Operations", activityType: "waste_disposal" },
    // GHG Protocol Scope 3 — all 15 categories (Cat 1 = purchased-goods, Cat 4 = upstream-transport,
    // Cat 5 = waste, Cat 6 = business-travel, Cat 7 = commuting are above; adding remaining 10)
    { scope: 3, code: "s3-capital-goods", name: "Capital Goods", activityType: "capital_goods_spend" },
    { scope: 3, code: "s3-fuel-energy", name: "Fuel- and Energy-Related Activities", activityType: "fuel_energy_activities" },
    { scope: 3, code: "s3-upstream-leased", name: "Upstream Leased Assets", activityType: "upstream_leased_assets" },
    { scope: 3, code: "s3-downstream-transport", name: "Downstream Transportation & Distribution", activityType: "downstream_transport" },
    { scope: 3, code: "s3-processing-sold", name: "Processing of Sold Products", activityType: "processing_sold_products" },
    { scope: 3, code: "s3-use-sold", name: "Use of Sold Products", activityType: "use_of_sold_products" },
    { scope: 3, code: "s3-end-of-life", name: "End-of-Life Treatment of Sold Products", activityType: "end_of_life_sold" },
    { scope: 3, code: "s3-downstream-leased", name: "Downstream Leased Assets", activityType: "downstream_leased_assets" },
    { scope: 3, code: "s3-franchises", name: "Franchises", activityType: "franchise_emissions" },
    { scope: 3, code: "s3-investments", name: "Investments", activityType: "investment_emissions" },
  ];

  for (const cat of categories) {
    await prisma.emissionCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  const defra = await prisma.factorLibrary.upsert({
    where: { name_version: { name: "DEFRA", version: "2025.1" } },
    update: {},
    create: {
      name: "DEFRA",
      version: "2025.1",
      license: "Open Government Licence v3.0",
      sourceUrl: "https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting",
      publishedAt: new Date("2025-06-01"),
    },
  });

  const epa = await prisma.factorLibrary.upsert({
    where: { name_version: { name: "EPA", version: "2025.1" } },
    update: {},
    create: {
      name: "EPA",
      version: "2025.1",
      license: "Public Domain (US Government Work)",
      sourceUrl: "https://www.epa.gov/climateleadership/ghg-emission-factors-hub",
      publishedAt: new Date("2025-01-01"),
    },
  });

  const categoryIdByCode = new Map(
    (await prisma.emissionCategory.findMany({ select: { id: true, code: true } })).map((c) => [
      c.code,
      c.id,
    ]),
  );
  const cat = (code: string) => {
    const id = categoryIdByCode.get(code);
    if (!id) throw new Error(`Missing seeded category: ${code}`);
    return id;
  };

  type SeedFactor = {
    externalId: string;
    libraryId: string;
    scope: number;
    categoryCode: string;
    activityType?: string;
    geographyCountry?: string;
    inputUnit: string;
    co2?: number;
    ch4?: number;
    n2o?: number;
    co2e?: number;
    uncertaintyRating?: string;
    usageNotes?: string;
  };

  const factors: SeedFactor[] = [
    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 1 — STATIONARY COMBUSTION (DEFRA 2025, UK, gross calorific value)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Natural gas (per kWh gross CV) ─────────────────────────────────────
    {
      externalId: "defra-2025-natgas-kwh",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kWh",
      co2: 0.18256, ch4: 0.00000824, n2o: 0.00000037,
      usageNotes: "Natural gas, gross CV. DEFRA 2025 conversion factors.",
    },

    // ── Liquid fuels (per litre) ────────────────────────────────────────────
    {
      externalId: "defra-2025-burning-oil-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.54039,
      usageNotes: "Burning oil (kerosene for heating). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-lpg-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 1.55709,
      usageNotes: "LPG (butane/propane mix), commercial. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-gasoil-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.76476,
      usageNotes: "Gas oil (red diesel for stationary engines/heating). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-heavyfueloil-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 3.17997,
      usageNotes: "Heavy fuel oil (bunker, marine fuel oil). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-diesel-stationary-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.69364,
      usageNotes: "Diesel for stationary generators. DEFRA 2025.",
    },

    // ── Solid fuels (per tonne → normalised to kg in engine) ───────────────
    {
      externalId: "defra-2025-coal-industrial-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 2.42310,
      usageNotes: "Industrial coal. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-wood-chips-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 0.01540,
      usageNotes: "Wood chips (biomass boiler). Biogenic CO2 excluded per GHG Protocol. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-wood-pellets-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 0.01539,
      usageNotes: "Wood pellets (biomass boiler). Biogenic CO2 excluded. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 1 — MOBILE COMBUSTION (DEFRA 2025, average biofuel blend)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Fuel-based (per litre) ──────────────────────────────────────────────
    {
      externalId: "defra-2025-diesel-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2: 2.49846, ch4: 0.00002330, n2o: 0.00004840,
      usageNotes: "Diesel, average biofuel blend for road vehicles. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-petrol-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.09767,
      usageNotes: "Petrol, average biofuel blend. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-cng-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 2.54282,
      usageNotes: "Compressed natural gas (CNG) for vehicles. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-lng-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "kg",
      co2e: 2.75253,
      usageNotes: "Liquefied natural gas (LNG) for HGVs. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-hvo-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 0.19524,
      usageNotes: "Hydrotreated Vegetable Oil (HVO) for road vehicles. DEFRA 2025. Well-to-wheel ~80% reduction vs diesel.",
    },

    // ── Distance-based cars (per km) ────────────────────────────────────────
    {
      externalId: "defra-2025-car-avg-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16984,
      usageNotes: "Car, average size and fuel, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-petrol-small-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.14477,
      usageNotes: "Small petrol car (<1.4L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-petrol-medium-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.18018,
      usageNotes: "Medium petrol car (1.4–2.0L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-petrol-large-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.22834,
      usageNotes: "Large petrol car (>2.0L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-diesel-small-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.13713,
      usageNotes: "Small diesel car (<1.7L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-diesel-medium-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16329,
      usageNotes: "Medium diesel car (1.7–2.0L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-diesel-large-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.21171,
      usageNotes: "Large diesel car (>2.0L), per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-bev-medium-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.04696,
      usageNotes: "Battery electric vehicle (BEV), medium, UK grid charge. Per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-car-phev-avg-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.08697,
      usageNotes: "Plug-in hybrid electric vehicle (PHEV), average, UK conditions. DEFRA 2025.",
    },

    // ── Vans and HGVs (per km) ───────────────────────────────────────────────
    {
      externalId: "defra-2025-van-diesel-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_van", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.24266,
      usageNotes: "Van diesel <3.5t, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-van-electric-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_van", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.07556,
      usageNotes: "Electric van <3.5t, UK grid charge, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-motorbike-avg-km",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion_motorbike", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.11360,
      usageNotes: "Motorbike, average size. Per vehicle.km. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 1 — FUGITIVE (Refrigerants, IPCC AR6 GWP-100)
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "ar6-r22-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 1960,
      usageNotes: "R-22 (HCFC-22). GWP-100 AR6. Phase-out refrigerant.",
    },
    {
      externalId: "ar6-r32-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 771,
      usageNotes: "R-32 (HFC-32). GWP-100 IPCC AR6. Common in split AC.",
    },
    {
      externalId: "ar6-r134a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 1530,
      usageNotes: "R-134a (HFC-134a). GWP-100 IPCC AR6.",
    },
    {
      externalId: "ar6-r407c-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 1774,
      usageNotes: "R-407C blend. GWP-100 IPCC AR6.",
    },
    {
      externalId: "ar6-r410a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 2256,
      usageNotes: "R-410A blend. GWP-100 IPCC AR6. Common in air conditioning.",
    },
    {
      externalId: "ar6-r404a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 3922,
      usageNotes: "R-404A blend. GWP-100 IPCC AR6. Common in commercial refrigeration.",
    },
    {
      externalId: "ar6-r507a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 3985,
      usageNotes: "R-507A blend. GWP-100 IPCC AR6.",
    },
    {
      externalId: "ar6-hfo-1234yf-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 1,
      usageNotes: "HFO-1234yf. GWP-100 IPCC AR6. Near-zero GWP replacement.",
    },
    {
      externalId: "ar6-co2-r744-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg", co2e: 1,
      usageNotes: "CO2 (R-744) natural refrigerant. GWP-100 = 1 by definition.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 2 — PURCHASED ELECTRICITY
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "defra-2025-elec-uk-lb-kwh",
      libraryId: defra.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.20705,
      usageNotes: "UK grid average, location-based (generation only). DEFRA/DESNZ 2025.",
    },
    {
      externalId: "defra-2025-elec-uk-mb-kwh",
      libraryId: defra.id, scope: 2, categoryCode: "s2-electricity-mb",
      activityType: "purchased_electricity_market", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.25864, uncertaintyRating: "high",
      usageNotes: "UK residual mix approximation. Use supplier-specific factor for market-based reporting. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-elec-ireland-lb-kwh",
      libraryId: defra.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "IE", inputUnit: "kWh",
      co2e: 0.29500,
      usageNotes: "Irish grid average, location-based. SEAI Ireland 2025 factor.",
    },
    {
      externalId: "defra-2025-elec-uk-td-kwh",
      libraryId: defra.id, scope: 3, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location_td", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.02273,
      usageNotes: "UK grid T&D losses (Scope 3, Category 3). Report alongside Scope 2 lb factor. DEFRA 2025.",
    },
    {
      externalId: "epa-2025-elec-us-lb-kwh",
      libraryId: epa.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "US", inputUnit: "kWh",
      co2e: 0.37120,
      usageNotes: "US national grid average (eGRID 2023). EPA GHG Emission Factors Hub 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 3 — BUSINESS TRAVEL (DEFRA 2025, per pkm)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Road ───────────────────────────────────────────────────────────────────
    {
      externalId: "defra-2025-biz-car-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_car", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16984,
      usageNotes: "Average car (all sizes/fuels), 1 passenger, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-car-bev-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_car_bev", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.04696,
      usageNotes: "Battery electric car, UK grid charge, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-taxi-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_taxi", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.14927,
      usageNotes: "Regular taxi, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-taxi-electric-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_taxi_electric", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.02893,
      usageNotes: "Electric taxi (e.g. London black cab BEV), per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-motorbike-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_motorbike", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.11360,
      usageNotes: "Motorbike, average size, per vehicle.km. DEFRA 2025.",
    },

    // ── Rail ───────────────────────────────────────────────────────────────────
    {
      externalId: "defra-2025-biz-rail-national-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_rail", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.035463,
      usageNotes: "National rail, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-rail-tube-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_rail_underground", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.026658,
      usageNotes: "London Underground / Overground, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-eurostar-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_rail_international", inputUnit: "km",
      co2e: 0.00431,
      usageNotes: "Eurostar international rail, per passenger.km (with WTT). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-bus-local-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_bus", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.10227,
      usageNotes: "Local bus, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-coach-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_coach", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.02716,
      usageNotes: "Coach (long-distance), per passenger.km. DEFRA 2025.",
    },

    // ── Air travel ─────────────────────────────────────────────────────────────
    {
      externalId: "defra-2025-biz-flight-domestic-econ-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_domestic", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.24587,
      usageNotes: "UK domestic flight, economy, including radiative forcing. Per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-flight-shorthaul-econ-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_shorthaul", inputUnit: "km",
      co2e: 0.15177,
      usageNotes: "Short-haul flight (<3,700 km), economy, with radiative forcing. Per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-flight-shorthaul-biz-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_shorthaul_biz", inputUnit: "km",
      co2e: 0.22766,
      usageNotes: "Short-haul flight, business class, with radiative forcing. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-flight-longhaul-econ-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_longhaul", inputUnit: "km",
      co2e: 0.14787,
      usageNotes: "Long-haul flight (>3,700 km), economy, with radiative forcing. Per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-flight-longhaul-biz-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_longhaul_biz", inputUnit: "km",
      co2e: 0.42831,
      usageNotes: "Long-haul flight, business class, with radiative forcing. Per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-biz-flight-longhaul-first-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel_flight_longhaul_first", inputUnit: "km",
      co2e: 0.59673,
      usageNotes: "Long-haul flight, first class, with radiative forcing. Per passenger.km. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 3 — EMPLOYEE COMMUTING (DEFRA 2025)
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "defra-2025-commute-car-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16984,
      usageNotes: "Average car, per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-car-bev-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting_bev", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.04696,
      usageNotes: "Battery electric car, UK grid. Per vehicle.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-bus-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting_bus", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.10227,
      usageNotes: "Local bus, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-rail-pkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting_rail", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.035463,
      usageNotes: "National rail, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-cycling-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting_cycling", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.00000,
      usageNotes: "Cycling / walking — zero operational emissions. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-motorbike-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting_motorbike", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.11360,
      usageNotes: "Motorbike, average size. Per vehicle.km. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 3 — PURCHASED GOODS & SERVICES (spend-based, EEIO)
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "eeio-2025-spend-avg-gbp",
      libraryId: defra.id, scope: 3, categoryCode: "s3-purchased-goods",
      activityType: "purchased_goods_spend", inputUnit: "GBP",
      co2e: 0.32, uncertaintyRating: "high",
      usageNotes: "Cross-sector EEIO average, per GBP spend. Approximation. DEFRA 2025.",
    },
    {
      externalId: "eeio-2025-construction-gbp",
      libraryId: defra.id, scope: 3, categoryCode: "s3-purchased-goods",
      activityType: "purchased_goods_construction", inputUnit: "GBP",
      co2e: 0.45, uncertaintyRating: "high",
      usageNotes: "Construction sector EEIO spend intensity, per GBP. DEFRA 2025.",
    },
    {
      externalId: "eeio-2025-it-services-gbp",
      libraryId: defra.id, scope: 3, categoryCode: "s3-purchased-goods",
      activityType: "purchased_goods_it_services", inputUnit: "GBP",
      co2e: 0.11, uncertaintyRating: "high",
      usageNotes: "IT services sector EEIO spend intensity, per GBP. DEFRA 2025.",
    },
    {
      externalId: "eeio-2025-food-catering-gbp",
      libraryId: defra.id, scope: 3, categoryCode: "s3-purchased-goods",
      activityType: "purchased_goods_food", inputUnit: "GBP",
      co2e: 0.68, uncertaintyRating: "high",
      usageNotes: "Food & catering sector EEIO spend intensity, per GBP. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // SCOPE 3 — UPSTREAM TRANSPORT (DEFRA 2025, freight)
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "defra-2025-hgv-avg-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.10749,
      usageNotes: "HGV all sizes, average laden, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-hgv-rigid-avg-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_hgv_rigid", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.11133,
      usageNotes: "HGV rigid all sizes, average laden, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-hgv-artic-avg-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_hgv_artic", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.07992,
      usageNotes: "HGV articulated all sizes, average laden, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-hgv-7.5t-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_hgv_7.5t", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.27162,
      usageNotes: "HGV 7.5t rigid, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-hgv-40t-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_hgv_40t", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.06293,
      usageNotes: "HGV articulated 40t, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-van-diesel-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_van", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.56164,
      usageNotes: "Van diesel <3.5t, per tonne.km (assuming ~1t payload). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-van-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_van_vehicle", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.23092,
      usageNotes: "Average van <3.5t, per vehicle.km (use when payload unknown). DEFRA 2025.",
    },
    {
      externalId: "defra-2025-freight-rail-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_rail", geographyCountry: "GB", inputUnit: "tonne.km",
      co2e: 0.02746,
      usageNotes: "Rail freight, UK, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-freight-sea-container-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_sea_container", inputUnit: "tonne.km",
      co2e: 0.01120,
      usageNotes: "Container ship, average, per tonne.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-freight-air-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport_air_freight", inputUnit: "tonne.km",
      co2e: 0.60200,
      usageNotes: "Air freight, per tonne.km, with radiative forcing. DEFRA 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // DEFRA — WASTE TREATMENT (per tonne) — consumed by field waste tickets
    // Indicative values from DEFRA conversion factor magnitudes; replace with
    // the exact rows from your DEFRA download via the factor import screen.
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "defra-2025-waste-mixed-landfill",
      libraryId: defra.id, scope: 3, categoryCode: "s3-waste",
      activityType: "waste_disposal", geographyCountry: "GB", inputUnit: "tonne",
      co2e: 467.0,
      usageNotes: "Mixed commercial & industrial waste to landfill. DEFRA 2025 (indicative).",
    },
    {
      externalId: "defra-2025-waste-mixed-recycling",
      libraryId: defra.id, scope: 3, categoryCode: "s3-waste",
      activityType: "waste_disposal", geographyCountry: "GB", inputUnit: "tonne",
      co2e: 21.3,
      usageNotes: "Mixed recyclables, closed-loop recycling. DEFRA 2025 (indicative).",
    },
    {
      externalId: "defra-2025-waste-inert-landfill",
      libraryId: defra.id, scope: 3, categoryCode: "s3-waste",
      activityType: "waste_disposal", geographyCountry: "GB", inputUnit: "tonne",
      co2e: 1.24,
      usageNotes: "Inert construction & demolition waste (soils, aggregates, concrete) to landfill. DEFRA 2025 (indicative).",
    },
    {
      externalId: "defra-2025-waste-wood-landfill",
      libraryId: defra.id, scope: 3, categoryCode: "s3-waste",
      activityType: "waste_disposal", geographyCountry: "GB", inputUnit: "tonne",
      co2e: 828.0,
      usageNotes: "Wood waste to landfill. DEFRA 2025 (indicative).",
    },
    {
      externalId: "defra-2025-waste-efw-incineration",
      libraryId: defra.id, scope: 3, categoryCode: "s3-waste",
      activityType: "waste_disposal", geographyCountry: "GB", inputUnit: "tonne",
      co2e: 21.3,
      usageNotes: "Mixed waste to energy-from-waste incineration. DEFRA 2025 (indicative).",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // EPA — US FUEL & GRID FACTORS
    // ══════════════════════════════════════════════════════════════════════════
    {
      externalId: "epa-2025-natgas-kwh",
      libraryId: epa.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "US", inputUnit: "kWh",
      co2e: 0.18116,
      usageNotes: "Natural gas. EPA GHG Emission Factors Hub 2025 (converted from mmBtu).",
    },
    {
      externalId: "epa-2025-diesel-litre",
      libraryId: epa.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "US", inputUnit: "litre",
      co2e: 2.70534,
      usageNotes: "Diesel fuel. EPA GHG Emission Factors Hub 2025 (converted from per gallon).",
    },
    {
      externalId: "epa-2025-petrol-litre",
      libraryId: epa.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "US", inputUnit: "litre",
      co2e: 2.34658,
      usageNotes: "Gasoline (petrol). EPA GHG Emission Factors Hub 2025 (converted from per gallon).",
    },
  ];

  let createdFactors = 0;
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
        emissionCategoryId: cat(f.categoryCode),
        activityType: f.activityType,
        geographyCountry: f.geographyCountry,
        effectiveStartDate: new Date("2025-01-01"),
        effectiveEndDate: new Date("2026-12-31"),
        inputUnit: f.inputUnit,
        co2: f.co2,
        ch4: f.ch4,
        n2o: f.n2o,
        co2e: f.co2e,
        uncertaintyRating: f.uncertaintyRating,
        usageNotes: f.usageNotes,
      },
    });
    createdFactors++;
  }

  // Social Value Themes (National TOMS Framework)
  const themes = [
    { code: "T1", name: "Jobs & Skills", sortOrder: 1 },
    { code: "T2", name: "Supporting Growth & Equal Opportunities", sortOrder: 2 },
    { code: "T3", name: "Healthier, Safer & More Resilient Communities", sortOrder: 3 },
    { code: "T4", name: "Decarbonisation & Protecting the Environment", sortOrder: 4 },
    { code: "T5", name: "Promoting Social Innovation", sortOrder: 5 },
  ];

  const tomsThemeIds = new Map<string, string>();
  for (const t of themes) {
    const theme = await prisma.socialValueTheme.upsert({
      where: { code: t.code },
      update: {},
      create: t,
    });
    tomsThemeIds.set(t.code, theme.id);
  }

  // National TOMS measures (representative subset of 48 measures)
  const measures = [
    // T1: Jobs & Skills
    { themeCode: "T1", tomsCode: "T1/M1", name: "Local People in Employment", unit: "FTE", valuePerUnit: 13220 },
    { themeCode: "T1", tomsCode: "T1/M2", name: "Local Apprenticeship Starts", unit: "starts", valuePerUnit: 17680 },
    { themeCode: "T1", tomsCode: "T1/M3", name: "Paid Employment for Disadvantaged Groups", unit: "FTE", valuePerUnit: 26440 },
    { themeCode: "T1", tomsCode: "T1/M4", name: "Training Days Provided", unit: "days", valuePerUnit: 215 },
    { themeCode: "T1", tomsCode: "T1/M5", name: "Work Experience Weeks", unit: "weeks", valuePerUnit: 320 },
    // T2: Growth & Equal Opportunities
    { themeCode: "T2", tomsCode: "T2/M1", name: "Local Supply Chain Spend", unit: "£", valuePerUnit: 0.06 },
    { themeCode: "T2", tomsCode: "T2/M2", name: "SME Supply Chain Spend", unit: "£", valuePerUnit: 0.06 },
    { themeCode: "T2", tomsCode: "T2/M3", name: "Social Enterprise / Voluntary Sector Spend", unit: "£", valuePerUnit: 0.06 },
    // T3: Healthier, Safer Communities
    { themeCode: "T3", tomsCode: "T3/M1", name: "Volunteering Days by Employees", unit: "days", valuePerUnit: 145 },
    { themeCode: "T3", tomsCode: "T3/M2", name: "Community Investment", unit: "£", valuePerUnit: 1 },
    { themeCode: "T3", tomsCode: "T3/M3", name: "Health & Wellbeing Activities", unit: "participants", valuePerUnit: 110 },
    // T4: Decarbonisation & Environment
    { themeCode: "T4", tomsCode: "T4/M1", name: "CO2e Reduced", unit: "tCO2e", valuePerUnit: 40 },
    { themeCode: "T4", tomsCode: "T4/M2", name: "Waste Diverted from Landfill", unit: "tonnes", valuePerUnit: 55 },
    { themeCode: "T4", tomsCode: "T4/M3", name: "Renewable Energy Generated On-Site", unit: "kWh", valuePerUnit: 0.04 },
    // T5: Social Innovation
    { themeCode: "T5", tomsCode: "T5/M1", name: "Innovation Activities Delivered", unit: "activities", valuePerUnit: 2500 },
    { themeCode: "T5", tomsCode: "T5/M2", name: "Digital Skills Training", unit: "participants", valuePerUnit: 530 },
  ];

  for (const m of measures) {
    await prisma.socialValueMeasure.upsert({
      where: { tomsCode: m.tomsCode },
      update: {},
      create: {
        themeId: tomsThemeIds.get(m.themeCode)!,
        tomsCode: m.tomsCode,
        name: m.name,
        unit: m.unit,
        valuePerUnit: m.valuePerUnit,
        active: true,
      },
    });
  }

  // ── Embodied carbon material library (ICE Database v3.0 / CarboLifeCalc)
  // GWP factors in kgCO2e per kg (A1-A3 cradle-to-gate) unless noted.
  // Sources: ICE v3.0 (Bath), RICS Professional Statement 2017, CIBSE TM65.
  const embodiedMaterials = [
    // Concrete & cement
    { name: "General Purpose Cement (CEM I)", category: "concrete", gwpA1A3: 0.82,  gwpA4: 0.008, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Ready Mix Concrete (25 MPa, 300 kg/m3 cement)", category: "concrete", gwpA1A3: 0.11,  gwpA4: 0.006, declaredUnit: "kg", density: 2400, source: "ICE v3.0" },
    { name: "Precast Concrete Panel", category: "concrete", gwpA1A3: 0.16,  gwpA4: 0.010, declaredUnit: "kg", density: 2400, source: "ICE v3.0" },
    { name: "Reinforced Concrete (slab, 250mm)", category: "concrete", gwpA1A3: 0.132, gwpA4: 0.007, declaredUnit: "kg", density: 2500, source: "ICE v3.0" },
    // Steel
    { name: "Structural Steel (virgin, UK EAF)", category: "steel", gwpA1A3: 1.77,  gwpA4: 0.020, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Structural Steel (recycled content, UK EAF)", category: "steel", gwpA1A3: 0.51,  gwpA4: 0.020, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Reinforcing Bar (rebar, recycled)", category: "steel", gwpA1A3: 0.55,  gwpA4: 0.018, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Cold-Rolled Steel Sheet", category: "steel", gwpA1A3: 2.11,  gwpA4: 0.021, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Stainless Steel 304", category: "steel", gwpA1A3: 6.15,  gwpA4: 0.025, declaredUnit: "kg", source: "ICE v3.0" },
    // Timber
    { name: "Sawn Softwood Timber (kiln dried)", category: "timber", gwpA1A3: 0.263, gwpA4: 0.015, declaredUnit: "kg", density: 470, source: "ICE v3.0" },
    { name: "Glued Laminated Timber (Glulam)", category: "timber", gwpA1A3: 0.512, gwpA4: 0.015, declaredUnit: "kg", density: 480, source: "ICE v3.0" },
    { name: "Cross-Laminated Timber (CLT)", category: "timber", gwpA1A3: 0.437, gwpA4: 0.015, declaredUnit: "kg", density: 490, source: "ICE v3.0" },
    { name: "Plywood", category: "timber", gwpA1A3: 0.72,  gwpA4: 0.018, declaredUnit: "kg", density: 530, source: "ICE v3.0" },
    { name: "Oriented Strand Board (OSB)", category: "timber", gwpA1A3: 0.45,  gwpA4: 0.015, declaredUnit: "kg", density: 600, source: "ICE v3.0" },
    // Masonry
    { name: "Dense Aggregate Block", category: "masonry", gwpA1A3: 0.073, gwpA4: 0.010, declaredUnit: "kg", density: 2100, source: "ICE v3.0" },
    { name: "Aerated Concrete Block (AAC)", category: "masonry", gwpA1A3: 0.38,  gwpA4: 0.009, declaredUnit: "kg", density: 650, source: "ICE v3.0" },
    { name: "Facing Brick", category: "masonry", gwpA1A3: 0.22,  gwpA4: 0.010, declaredUnit: "kg", density: 1900, source: "ICE v3.0" },
    { name: "Concrete Roof Tile", category: "masonry", gwpA1A3: 0.096, gwpA4: 0.008, declaredUnit: "kg", density: 2000, source: "ICE v3.0" },
    // Insulation
    { name: "Mineral Wool (glass)", category: "insulation", gwpA1A3: 1.28,  gwpA4: 0.018, declaredUnit: "kg", density: 25, source: "ICE v3.0" },
    { name: "Mineral Wool (rock)", category: "insulation", gwpA1A3: 1.12,  gwpA4: 0.018, declaredUnit: "kg", density: 40, source: "ICE v3.0" },
    { name: "Expanded Polystyrene (EPS)", category: "insulation", gwpA1A3: 3.29,  gwpA4: 0.012, declaredUnit: "kg", density: 20, source: "ICE v3.0" },
    { name: "Extruded Polystyrene (XPS)", category: "insulation", gwpA1A3: 4.66,  gwpA4: 0.012, declaredUnit: "kg", density: 35, source: "ICE v3.0" },
    { name: "Rigid PIR / PUR Board", category: "insulation", gwpA1A3: 4.49,  gwpA4: 0.011, declaredUnit: "kg", density: 32, source: "ICE v3.0" },
    // Glass & glazing
    { name: "Float Glass", category: "glass", gwpA1A3: 0.91,  gwpA4: 0.025, declaredUnit: "kg", density: 2500, source: "ICE v3.0" },
    { name: "Double-Glazed Unit (standard low-e)", category: "glass", gwpA1A3: 28.0, gwpA4: 0.900, declaredUnit: "m2", source: "ICE v3.0" },
    // Aluminium
    { name: "Aluminium (primary, smelted)", category: "aluminium", gwpA1A3: 11.46, gwpA4: 0.025, declaredUnit: "kg", density: 2700, source: "ICE v3.0" },
    { name: "Aluminium (recycled, UK)", category: "aluminium", gwpA1A3: 1.69,  gwpA4: 0.025, declaredUnit: "kg", density: 2700, source: "ICE v3.0" },
    { name: "Aluminium Curtain Walling", category: "aluminium", gwpA1A3: 52.0, gwpA4: 1.200, declaredUnit: "m2", source: "ICE v3.0" },
    // Cladding & finishes
    { name: "Plasterboard (standard)", category: "finishes", gwpA1A3: 0.39,  gwpA4: 0.010, declaredUnit: "kg", density: 800, source: "ICE v3.0" },
    { name: "Gypsum Plaster", category: "finishes", gwpA1A3: 0.12,  gwpA4: 0.009, declaredUnit: "kg", source: "ICE v3.0" },
    { name: "Ceramic Floor Tile", category: "finishes", gwpA1A3: 0.73,  gwpA4: 0.012, declaredUnit: "kg", density: 2000, source: "ICE v3.0" },
    { name: "Carpet (nylon, broadloom)", category: "finishes", gwpA1A3: 5.30,  gwpA4: 0.032, declaredUnit: "kg", density: 2, source: "ICE v3.0" },
    // Services & MEP
    { name: "Copper Pipe", category: "services", gwpA1A3: 3.77,  gwpA4: 0.020, declaredUnit: "kg", density: 8900, source: "ICE v3.0" },
    { name: "PVC-U Pipe", category: "services", gwpA1A3: 2.41,  gwpA4: 0.018, declaredUnit: "kg", density: 1400, source: "ICE v3.0" },
    { name: "HDPE Pipe", category: "services", gwpA1A3: 2.12,  gwpA4: 0.016, declaredUnit: "kg", density: 950, source: "ICE v3.0" },
  ];

  let createdMaterials = 0;
  for (const m of embodiedMaterials) {
    const { gwpA4, density, ...core } = m;
    await prisma.embodiedMaterial.upsert({
      where: { name: m.name },
      update: {},
      create: {
        ...core,
        gwpA4: gwpA4 ?? null,
        density: density ?? null,
      },
    });
    createdMaterials++;
  }

  // Framework datapoint crosswalk — reference data shared across every
  // organisation, resolved per-org via lib/compliance/datapoint-resolvers.ts.
  const { FRAMEWORK_DATAPOINTS } = await import("../lib/compliance/framework-datapoints");
  let createdDatapoints = 0;
  for (const dp of FRAMEWORK_DATAPOINTS) {
    await prisma.frameworkDatapoint.upsert({
      where: { framework_code: { framework: dp.framework, code: dp.code } },
      update: {
        title: dp.title,
        description: dp.description,
        category: dp.category,
        resolverKey: dp.resolverKey,
      },
      create: {
        framework: dp.framework,
        code: dp.code,
        title: dp.title,
        description: dp.description,
        category: dp.category,
        resolverKey: dp.resolverKey,
      },
    });
    createdDatapoints++;
  }

  console.log(
    `Seed complete: methodology version, emission categories, factor libraries, ${createdFactors} new emission factors, ${themes.length} TOMS themes, ${measures.length} TOMS measures, ${createdMaterials} embodied materials, ${createdDatapoints} framework datapoints.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
