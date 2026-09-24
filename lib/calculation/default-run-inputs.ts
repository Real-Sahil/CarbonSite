// The factor library and methodology for a calculation nobody picked by hand:
// the automatic run after a field submission is approved, and the one-record
// calculation behind a waste record. Taking the newest library row instead
// priced a UK organisation with EPA factors (or a spend-only library), so:
//   1. the library and methodology behind the period's latest published
//      snapshot, the set the organisation deliberately chose (an earlier
//      automatic run is not a choice, so it is never copied);
//   2. otherwise, for an organisation outside the UK, the newest activity
//      library written for its country (EPA for the US, ADEME for France);
//   3. otherwise the DEFRA set for the period's end year
//      (chooseFactorLibrary). Always the newest methodology.

import { prisma } from "@/lib/db";
import { chooseFactorLibrary, currentFactorLibraries } from "./library-for-period";
import { libraryCountry } from "./library-country";
import { countryIso2 } from "./geography";

// Spend-only sets price purchases by industry; they are drawn on per record
// (spend-supplement.ts), never as a run's whole library.
const SPEND_ONLY = /^(EPA USEEIO|Defra UK spend)/i;

export async function defaultRunInputs(
  orgId: string,
  reportingPeriodId: string,
): Promise<{ factorLibraryId: string; methodologyVersionId: string } | null> {
  const published = await prisma.publishedSnapshot.findFirst({
    where: { organizationId: orgId, reportingPeriodId },
    orderBy: { publishedAt: "desc" },
    select: { calculationRun: { select: { factorLibraryId: true, methodologyVersionId: true } } },
  });
  if (published) return published.calculationRun;

  const [period, libraries, methodology, org] = await Promise.all([
    prisma.reportingPeriod.findFirst({
      where: { id: reportingPeriodId, organizationId: orgId },
      select: { endDate: true },
    }),
    prisma.factorLibrary.findMany({ select: { id: true, name: true, version: true } }),
    prisma.methodologyVersion.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { hqCountry: true } }),
  ]);
  if (!period || !methodology) return null;
  const current = currentFactorLibraries(libraries);
  const country = countryIso2(org?.hqCountry);
  const national =
    country && country !== "GB"
      ? current
          .filter((l) => !SPEND_ONLY.test(l.name) && libraryCountry(l.name) === country)
          .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0]
      : undefined;
  const library = national ?? chooseFactorLibrary(current, period.endDate);
  if (!library) return null;
  return { factorLibraryId: library.id, methodologyVersionId: methodology.id };
}
