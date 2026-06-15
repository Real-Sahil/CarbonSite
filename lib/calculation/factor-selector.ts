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
  /** For Scope 2 categories: prefer market-based factor when "market_based" */
  scope2Method?: "location_based" | "market_based";
};

export type FactorSelection = {
  factor: EmissionFactor;
  selectionReason: string;
  warnings?: string[];
};

function scoreCandidate(
  f: EmissionFactor,
  query: FactorQuery,
): { score: number; reason: string } {
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

  return { score, reason: reasons.join(", ") };
}

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

  // When market-based Scope 2 is requested, prefer factors with "market" in
  // activityType or a supplier-specific geographyRegion set.
  if (query.scope2Method === "market_based") {
    const marketCandidates = candidates.filter(
      (f) =>
        (f.activityType != null && f.activityType.toLowerCase().includes("market")) ||
        (f.geographyRegion != null && f.geographyRegion !== ""),
    );

    if (marketCandidates.length > 0) {
      const scored = marketCandidates
        .map((f) => ({ factor: f, ...scoreCandidate(f, query) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0];
      return {
        factor: best.factor,
        selectionReason: `market-based: ${best.reason}`,
        warnings: [],
      };
    }

    // No market-based factor found — fall back to location-based with warning
    const scored = candidates
      .map((f) => ({ factor: f, ...scoreCandidate(f, query) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      factor: best.factor,
      selectionReason: `location-based fallback: ${best.reason}`,
      warnings: ["No market-based factor found, using location-based as fallback."],
    };
  }

  // Default scoring: exact geography (2) > wildcard geography (1) + activity type match bonus
  const scored = candidates
    .map((f) => ({ factor: f, ...scoreCandidate(f, query) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];

  return { factor: best.factor, selectionReason: best.reason, warnings: [] };
}
