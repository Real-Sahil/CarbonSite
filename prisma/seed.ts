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

  // Seed a placeholder factor library record.
  // Actual factors are loaded via the admin factor import mechanism.
  // For development/test, add sample factors below this block.
  await prisma.factorLibrary.upsert({
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

  await prisma.factorLibrary.upsert({
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

  console.log("Seed complete: methodology version, emission categories, factor library records.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
