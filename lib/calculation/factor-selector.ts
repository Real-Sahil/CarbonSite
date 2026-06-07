// Factor selection — deterministic, records the selection reason for audit.
// Precedence (highest first): geography match > activity type match > date validity

import { prisma } from "@/lib/db";
import type { EmissionFactor } from "@prisma/client";

export type FactorQuery = {
  emissionCategoryId: string;
  activityType?: string | null;
  geographyCountry?: string | null;
  activityDate: Date;
  factorLibraryId: string;
};

export type FactorSelection = {
  factor: EmissionFactor;
  selectionReason: string;
};

export async function selectFactor(query: FactorQuery): Promise<FactorSelection | null> {
  const candidates = await prisma.emissionFactor.findMany({
    where: {
      factorLibraryId: query.factorLibraryId,
      emissionCategoryId: query.emissionCategoryId,
      OR: [
        { effectiveStartDate: null },
        { effectiveStartDate: { lte: query.activityDate } },
      ],
      AND: [
        {
          OR: [
            { effectiveEndDate: null },
            { effectiveEndDate: { gte: query.activityDate } },
          ],
        },
      ],
    },
  });

  if (candidates.length === 0) return null;

  // Score candidates: exact geography (2) > wildcard geography (1) + activity type match bonus
  const scored = candidates.map((f) => {
    let score = 0;
    const reasons: string[] = [];

    if (f.geographyCountry && f.geographyCountry === query.geographyCountry) {
      score += 2;
      reasons.push(`geography matched ${f.geographyCountry}`);
    } else if (!f.geographyCountry) {
      score += 1;
      reasons.push("global factor");
    }

    if (f.activityType && f.activityType === query.activityType) {
      score += 1;
      reasons.push(`activity type matched ${f.activityType}`);
    }

    return { factor: f, score, reason: reasons.join(", ") };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return { factor: best.factor, selectionReason: best.reason };
}
