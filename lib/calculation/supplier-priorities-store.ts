import { prisma } from "@/lib/db";
import { convertCurrency, prefetchFxRatesOn } from "./units";
import { groupSupplierPriorities, type PriorityCalcInput } from "./supplier-priorities";

/** Rows per createMany (10 columns each, well under Postgres's 65,535 bind limit). */
const PRIORITY_INSERT_CHUNK = 2000;

/**
 * Replace the supplier priority rows of one calculation run. Spend is converted
 * to the organisation's reporting currency at each record's date, so the rates
 * are fetched first, once per day. Safe to repeat: a retried finalisation
 * deletes its own rows before writing.
 */
export async function writeSupplierPriorities(args: {
  orgId: string;
  reportingPeriodId: string;
  calculationRunId: string;
  calculations: PriorityCalcInput[];
}): Promise<number> {
  const { orgId, reportingPeriodId, calculationRunId, calculations } = args;
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { reportingCurrency: true },
  });
  const reportingCurrency = (org?.reportingCurrency ?? "GBP").trim().toUpperCase();

  const foreignSpendDates = calculations.flatMap(({ activityRecord: r }) => {
    const currency = r.spendCurrency?.trim().toUpperCase() ?? "";
    const day = r.activityDate ?? r.startDate;
    return currency && currency !== reportingCurrency && day ? [day] : [];
  });
  if (foreignSpendDates.length > 0) await prefetchFxRatesOn(foreignSpendDates);

  const rows = groupSupplierPriorities(calculations, {
    reportingCurrency,
    convert: (amount, from, to, onDate) => convertCurrency(amount, from, to, onDate)?.amount ?? null,
  });

  await prisma.$transaction(
    async (tx) => {
      await tx.supplierPriority.deleteMany({ where: { organizationId: orgId, calculationRunId } });
      for (let i = 0; i < rows.length; i += PRIORITY_INSERT_CHUNK) {
        await tx.supplierPriority.createMany({
          data: rows.slice(i, i + PRIORITY_INSERT_CHUNK).map((row) => ({
            organizationId: orgId,
            reportingPeriodId,
            calculationRunId,
            supplierKey: row.supplierKey,
            supplierName: row.supplierName,
            spendAmount: row.spendAmount,
            spendCurrency: row.spendCurrency,
            spendRecordCount: row.spendRecordCount,
            unconvertedSpendRecordCount: row.unconvertedSpendRecordCount,
            totalCo2eKg: row.totalCo2eKg,
            recordCount: row.recordCount,
            spendRank: row.spendRank,
            emissionsRank: row.emissionsRank,
          })),
        });
      }
    },
    { timeout: 60_000 },
  );
  return rows.length;
}
