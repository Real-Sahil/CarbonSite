// @vitest-environment node
// Golden numbers: a small UK inventory calculated end to end through the real
// engine (processCalculationRun) against the real factor libraries, checked
// against values worked out by hand from the published factors. Needs a
// database with every migration applied and the seed run, so it only runs
// with RUN_DB_TESTS=1 (CI's web job sets it after `prisma db seed`).
//
// It guards the failures a pilot run found: a UK site's electricity priced
// with the Irish grid factor because only the record's own country was
// matched, and automatic runs priced with the wrong library.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { processCalculationRun } from "@/lib/calculation/run-worker";
import { defaultRunInputs } from "@/lib/calculation/default-run-inputs";

const RUN = process.env.RUN_DB_TESTS === "1";

// kg CO2e = amount x DESNZ 2025 (flat file v1) factor. Spend: £250,000 at
// 2025 prices deflated to 2023 with UK CPI, x the Defra UK multiplier for
// SIC 41.2 (buildings).
const RECORDS = [
  { key: "electricity", code: "s2-electricity-lb", amount: 120000, unit: "kWh", kg: 120000 * 0.177 },
  { key: "gas", code: "s1-stationary", amount: 85000, unit: "kWh", fuelType: "natural gas", kg: 85000 * 0.18296 },
  { key: "diesel", code: "s1-mobile", amount: 14000, unit: "litres", fuelType: "diesel", kg: 14000 * 2.57082 },
  { key: "hvo", code: "s1-mobile", amount: 3000, unit: "litres", fuelType: "HVO", kg: 3000 * 0.03558 },
  { key: "heat", code: "s2-heat", amount: 40000, unit: "kWh", kg: 40000 * 0.17529 },
  { key: "rail", code: "s3-business-travel", amount: 8000, unit: "km", transportMode: "rail", kg: 8000 * 0.03546 },
  { key: "spend", code: "s3-purchased-goods", amount: 250000, unit: "GBP", industryCode: "41.20", kg: 54657.48 },
  // No facility: the organisation's country (GB) applies.
  { key: "elec-no-facility", code: "s2-electricity-lb", amount: 1000, unit: "kWh", noFacility: true, kg: 177 },
  // The record's own country wins over the facility's.
  { key: "elec-ireland", code: "s2-electricity-lb", amount: 1000, unit: "kWh", country: "Ireland", kg: 295 },
] as const;

describe.skipIf(!RUN)("golden inventory (DEFRA 2025.2, UK organisation)", () => {
  const tag = `golden-${Date.now()}`;
  let orgId = "";
  let periodId = "";
  const recordIds = new Map<string, string>();
  const kgByKey = new Map<string, number>();

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `${tag}@example.test`, name: "Golden" } });
    const org = await prisma.organization.create({ data: { name: tag, hqCountry: "GB" } });
    orgId = org.id;
    const period = await prisma.reportingPeriod.create({
      data: { organizationId: orgId, type: "year", startDate: new Date("2025-01-01"), endDate: new Date("2025-12-31"), label: "FY2025" },
    });
    periodId = period.id;
    const facility = await prisma.facility.create({ data: { organizationId: orgId, name: "Leeds depot", country: "GB" } });
    const categories = new Map(
      (await prisma.emissionCategory.findMany({ select: { id: true, code: true } })).map((c) => [c.code, c.id]),
    );

    for (const r of RECORDS) {
      const rec = await prisma.activityRecord.create({
        data: {
          organizationId: orgId,
          reportingPeriodId: periodId,
          emissionCategoryId: categories.get(r.code)!,
          facilityId: "noFacility" in r ? null : facility.id,
          amount: r.amount,
          unit: r.unit,
          activityDate: new Date("2025-06-30"),
          fuelType: "fuelType" in r ? r.fuelType : null,
          transportMode: "transportMode" in r ? r.transportMode : null,
          industryCode: "industryCode" in r ? r.industryCode : null,
          country: "country" in r ? r.country : null,
          reviewStatus: "approved",
          createdByUserId: user.id,
        },
      });
      recordIds.set(r.key, rec.id);
    }

    // No snapshot yet, so this is the library an automatic run would use.
    const inputs = await defaultRunInputs(orgId, periodId);
    const run = await prisma.calculationRun.create({
      data: { organizationId: orgId, reportingPeriodId: periodId, triggeredByUserId: user.id, triggerHash: tag, ...inputs! },
    });
    for (let i = 0; i < 20 && !(await processCalculationRun(run.id, orgId)).done; i++);

    const calcs = await prisma.emissionCalculation.findMany({
      where: { calculationRunId: run.id },
      select: { activityRecordId: true, totalCo2e: true },
    });
    for (const [key, id] of recordIds) {
      const c = calcs.find((x) => x.activityRecordId === id);
      if (c) kgByKey.set(key, Number(c.totalCo2e));
    }
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uses the DEFRA set for the period when nothing is published", async () => {
    const inputs = await defaultRunInputs(orgId, periodId);
    const lib = await prisma.factorLibrary.findUnique({ where: { id: inputs!.factorLibraryId } });
    expect(`${lib?.name} ${lib?.version}`).toBe("DEFRA 2025.2");
  });

  for (const r of RECORDS) {
    it(`${r.key}: ${r.amount} ${r.unit} = ${r.kg.toFixed(2)} kg CO2e`, () => {
      expect(kgByKey.get(r.key)).toBeCloseTo(r.kg, 1);
    });
  }
});
