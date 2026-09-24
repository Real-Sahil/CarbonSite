import { prisma } from "@/lib/db";
import { factorAttribution, type LibraryLicence } from "./attribution";

/**
 * Attribution for every factor library a calculation run used: the run's own
 * library first, then any spend library that priced records by industry
 * (lib/calculation/spend-supplement.ts), each credited under its licence.
 */
export async function runFactorAttribution(calculationRunId: string, runLibrary: LibraryLicence | null): Promise<string | null> {
  const others = await prisma.factorLibrary.findMany({
    where: {
      factors: { some: { calculations: { some: { calculationRunId } } } },
      ...(runLibrary ? { NOT: { name: runLibrary.name, version: runLibrary.version } } : {}),
    },
    select: { name: true, version: true, license: true, sourceUrl: true },
    orderBy: [{ name: "asc" }, { version: "asc" }],
  });
  const lines = [runLibrary, ...others].map((l) => factorAttribution(l)).filter((s): s is string => !!s);
  return lines.length ? lines.join(" ") : null;
}
