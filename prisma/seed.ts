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
  ];

  for (const cat of categories) {
    await prisma.emissionCategory.upsert({
      where: { code: cat.code },
      update: {},
      create: cat,
    });
  }

  // Factor libraries. Production factor rows are refreshed via the admin
  // factor import; the seed below loads the DEFRA/EPA baseline so a new
  // environment can calculate immediately.
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

  // Baseline emission factors. All values kg CO2e per canonical input unit
  // (kWh / litre / kg / km / GBP — see lib/calculation/units.ts).
  // Gas-specific rows store raw gas mass; the engine applies AR6 GWPs
  // (CH4 = 27.9, N2O = 273). Scalar rows store pre-computed co2e.
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
    // ── Scope 1 · Stationary combustion (DEFRA fuels, gross CV) ──────────────
    {
      externalId: "defra-2025-natgas-kwh",
      libraryId: defra.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "GB", inputUnit: "kWh",
      co2: 0.18256, ch4: 0.00000824, n2o: 0.00000037,
      usageNotes: "Natural gas, gross CV. DEFRA 2025 conversion factors.",
    },
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
      usageNotes: "LPG. DEFRA 2025.",
    },

    // ── Scope 1 · Mobile combustion (DEFRA average biofuel blends) ───────────
    {
      externalId: "defra-2025-diesel-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2: 2.49846, ch4: 0.0000233, n2o: 0.0000484,
      usageNotes: "Diesel, average biofuel blend. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-petrol-litre",
      libraryId: defra.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "GB", inputUnit: "litre",
      co2e: 2.09767,
      usageNotes: "Petrol, average biofuel blend. DEFRA 2025.",
    },

    // ── Scope 1 · Fugitive (refrigerants, IPCC AR6 GWP-100) ──────────────────
    {
      externalId: "ar6-r410a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg",
      co2e: 2256,
      usageNotes: "R-410A refrigerant leakage, GWP-100 from IPCC AR6.",
    },
    {
      externalId: "ar6-r134a-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg",
      co2e: 1526,
      usageNotes: "R-134a refrigerant leakage, GWP-100 from IPCC AR6.",
    },
    {
      externalId: "ar6-r32-kg",
      libraryId: defra.id, scope: 1, categoryCode: "s1-fugitive",
      activityType: "fugitive_refrigerants", inputUnit: "kg",
      co2e: 771,
      usageNotes: "R-32 refrigerant leakage, GWP-100 from IPCC AR6.",
    },

    // ── Scope 2 · Electricity ─────────────────────────────────────────────────
    {
      externalId: "defra-2025-elec-uk-lb-kwh",
      libraryId: defra.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.20705,
      usageNotes: "UK grid average, location-based (generation). DEFRA 2025. Add T&D (0.01830) under Scope 3 where reported.",
    },
    {
      externalId: "epa-2025-elec-us-lb-kwh",
      libraryId: epa.id, scope: 2, categoryCode: "s2-electricity-lb",
      activityType: "purchased_electricity_location", geographyCountry: "US", inputUnit: "kWh",
      co2e: 0.3712,
      usageNotes: "US national grid average (eGRID). EPA GHG Emission Factors Hub 2025.",
    },
    {
      externalId: "defra-2025-elec-uk-mb-kwh",
      libraryId: defra.id, scope: 2, categoryCode: "s2-electricity-mb",
      activityType: "purchased_electricity_market", geographyCountry: "GB", inputUnit: "kWh",
      co2e: 0.25864, uncertaintyRating: "high",
      usageNotes: "UK residual-mix approximation. Replace with supplier-specific or contractual factor for market-based reporting.",
    },

    // ── Scope 3 · Business travel (DEFRA, per passenger.km) ──────────────────
    {
      externalId: "defra-2025-car-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      activityType: "business_travel", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16984,
      usageNotes: "Average car, unknown size and fuel. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-rail-national-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      geographyCountry: "GB", inputUnit: "km",
      co2e: 0.035463,
      usageNotes: "National rail, per passenger.km. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-flight-domestic-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      inputUnit: "km",
      co2e: 0.24587,
      usageNotes: "Domestic flight, average passenger, with radiative forcing. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-flight-longhaul-econ-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-business-travel",
      inputUnit: "km",
      co2e: 0.14787,
      usageNotes: "Long-haul flight, economy, with radiative forcing, per passenger.km. DEFRA 2025.",
    },

    // ── Scope 3 · Employee commuting (DEFRA) ─────────────────────────────────
    {
      externalId: "defra-2025-commute-car-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      activityType: "employee_commuting", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.16984,
      usageNotes: "Average car, unknown size and fuel. DEFRA 2025.",
    },
    {
      externalId: "defra-2025-commute-bus-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-commuting",
      geographyCountry: "GB", inputUnit: "km",
      co2e: 0.10227,
      usageNotes: "Local bus, per passenger.km. DEFRA 2025.",
    },

    // ── Scope 3 · Purchased goods & services (spend-based, EEIO) ─────────────
    {
      externalId: "eeio-2025-spend-gbp",
      libraryId: defra.id, scope: 3, categoryCode: "s3-purchased-goods",
      activityType: "purchased_goods_spend", inputUnit: "GBP",
      co2e: 0.32, uncertaintyRating: "high",
      usageNotes: "Cross-sector EEIO average intensity per GBP spend. Approximation — refine with sector-specific intensities.",
    },

    // ── Scope 3 · Upstream transport (DEFRA freight) ─────────────────────────
    {
      externalId: "defra-2025-hgv-avg-tkm",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      activityType: "upstream_transport", geographyCountry: "GB", inputUnit: "km",
      co2e: 0.10749,
      usageNotes: "HGV all types, average laden, per tonne.km. DEFRA 2025. Record distance as tonne.km in km unit field.",
    },
    {
      externalId: "defra-2025-van-avg-km",
      libraryId: defra.id, scope: 3, categoryCode: "s3-upstream-transport",
      geographyCountry: "GB", inputUnit: "km",
      co2e: 0.23092,
      usageNotes: "Average van (up to 3.5 t), per vehicle.km. DEFRA 2025.",
    },

    // ── EPA US fuel factors ───────────────────────────────────────────────────
    {
      externalId: "epa-2025-diesel-litre",
      libraryId: epa.id, scope: 1, categoryCode: "s1-mobile",
      activityType: "mobile_combustion", geographyCountry: "US", inputUnit: "litre",
      co2e: 2.70534,
      usageNotes: "Diesel fuel. EPA GHG Emission Factors Hub 2025 (converted from per-gallon).",
    },
    {
      externalId: "epa-2025-natgas-kwh",
      libraryId: epa.id, scope: 1, categoryCode: "s1-stationary",
      activityType: "stationary_combustion", geographyCountry: "US", inputUnit: "kWh",
      co2e: 0.18116,
      usageNotes: "Natural gas. EPA GHG Emission Factors Hub 2025 (converted from per-mmBtu).",
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

  console.log(
    `Seed complete: methodology version, emission categories, factor libraries, ${createdFactors} new emission factors.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
