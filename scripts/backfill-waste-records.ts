// One-off backfill for the Phase H (water & waste) migration.
//
// Existing waste_records rows (created before this feature via the old
// disconnected /waste page) have no facility_id/reporting_period_id/
// activity_record_id. This script assigns a facility (only when the org
// has exactly one — otherwise it's flagged for manual assignment) and a
// reporting period (matching recorded_at against period date ranges),
// then runs the real calculation engine to create the linked
// ActivityRecord. Run once, after deploying the Phase H migration, before
// the follow-up migration that tightens facility_id/reporting_period_id
// to NOT NULL.
//
// Usage: pnpm tsx scripts/backfill-waste-records.ts

import { prisma } from "../lib/db";
import { syncWasteRecordCalculation } from "../lib/calculation/environmental-metrics";

async function main() {
  // facilityId/reportingPeriodId are NOT NULL as of the follow-up migration
  // (see migration 20260906000001) — this script now only needs to catch
  // rows that were backfilled with a facility/period but never got their
  // linked ActivityRecord calculated (e.g. a prior run's calculationFailed).
  const unassigned = await prisma.wasteRecord.findMany({
    where: { activityRecordId: null },
  });

  if (unassigned.length === 0) {
    console.log("No waste_records rows need backfilling.");
    return;
  }

  console.log(`Found ${unassigned.length} waste_records row(s) needing backfill.`);

  let backfilled = 0;
  let needsManualFacility = 0;
  let needsManualPeriod = 0;
  let calculationFailed = 0;

  for (const record of unassigned) {
    let facilityId = record.facilityId;
    let reportingPeriodId = record.reportingPeriodId;

    if (!facilityId) {
      const facilities = await prisma.facility.findMany({
        where: { organizationId: record.organizationId },
        select: { id: true },
      });
      if (facilities.length === 1) {
        facilityId = facilities[0].id;
      } else {
        needsManualFacility++;
        console.warn(
          `  [SKIP] waste_record ${record.id} (org ${record.organizationId}): ` +
            `${facilities.length} facilities exist, cannot auto-assign. Needs manual facility assignment.`,
        );
        continue;
      }
    }

    if (!reportingPeriodId) {
      const period = await prisma.reportingPeriod.findFirst({
        where: {
          organizationId: record.organizationId,
          startDate: { lte: record.recordedAt },
          endDate: { gte: record.recordedAt },
        },
        select: { id: true },
      });
      if (period) {
        reportingPeriodId = period.id;
      } else {
        needsManualPeriod++;
        console.warn(
          `  [SKIP] waste_record ${record.id} (org ${record.organizationId}): ` +
            `no reporting period covers ${record.recordedAt.toISOString().slice(0, 10)}. Needs manual period assignment.`,
        );
        continue;
      }
    }

    // Actor for the calculation run: the org's earliest admin membership,
    // since these legacy rows predate a per-record createdByUserId.
    const adminMembership = await prisma.organizationMembership.findFirst({
      where: { organizationId: record.organizationId, role: "admin" },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
    if (!adminMembership) {
      console.warn(`  [SKIP] waste_record ${record.id}: organisation has no admin member to attribute the backfill to.`);
      continue;
    }

    await prisma.wasteRecord.update({
      where: { id: record.id },
      data: { facilityId, reportingPeriodId, createdByUserId: adminMembership.userId },
    });

    try {
      await syncWasteRecordCalculation(record.id, adminMembership.userId);
      backfilled++;
      console.log(`  [OK] waste_record ${record.id} backfilled and calculated.`);
    } catch (err) {
      calculationFailed++;
      console.error(`  [CALC FAILED] waste_record ${record.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\nSummary:");
  console.log(`  Backfilled + calculated: ${backfilled}`);
  console.log(`  Needs manual facility assignment: ${needsManualFacility}`);
  console.log(`  Needs manual reporting period assignment: ${needsManualPeriod}`);
  console.log(`  Calculation failed (facility/period set, engine error): ${calculationFailed}`);
  if (needsManualFacility > 0 || needsManualPeriod > 0) {
    console.log(
      "\nRows needing manual assignment must be resolved via the /waste page (edit each record) " +
        "before the follow-up NOT NULL migration is applied.",
    );
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
