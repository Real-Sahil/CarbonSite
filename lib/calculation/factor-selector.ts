// Factor selection — deterministic, records the selection reason for audit.
// Precedence (highest first): unit compatibility > fuel/detail match >
// geography match > activity type match > date validity
//
// Pass a FactorCache (built once per calculation run) to eliminate per-record
// DB queries — 100k records go from ~100k queries to 0.

import { prisma } from "@/lib/db";
import type { EmissionFactor } from "@prisma/client";
import { areUnitsCompatible } from "./units";

// Pre-loaded factor table keyed by "factorLibraryId:emissionCategoryId".
// Build once at the start of a calculation run and pass to selectFactor.
export type FactorCache = Map<string, EmissionFactor[]>;

export async function buildFactorCache(factorLibraryId: string): Promise<FactorCache> {
  const allFactors = await prisma.emissionFactor.findMany({
    where: { factorLibraryId },
  });
  const cache: FactorCache = new Map();
  for (const factor of allFactors) {
    const key = `${factor.factorLibraryId}:${factor.emissionCategoryId}`;
    const bucket = cache.get(key);
    if (bucket) {
      bucket.push(factor);
    } else {
      cache.set(key, [factor]);
    }
  }
  return cache;
}

export type FactorQuery = {
  emissionCategoryId: string;
  activityType?: string | null;
  geographyCountry?: string | null;
  activityDate: Date;
  factorLibraryId: string;
  /** For Scope 2 categories: prefer market-based factor when "market_based" */
  scope2Method?: "location_based" | "market_based";
  /** The record's (normalized) unit — factors that can consume it rank first. */
  recordUnit?: string;
  /** Free-text detail from the record (fuel type, transport mode, refrigerant)
   *  matched against the factor's id/type/notes so e.g. a diesel record picks
   *  the diesel factor, not the petrol one in the same category. */
  matchHint?: string;
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

  // A factor whose input unit can't consume the record's unit is useless —
  // unit compatibility dominates every other criterion.
  if (query.recordUnit) {
    if (
      f.inputUnit === query.recordUnit ||
      areUnitsCompatible(f.inputUnit, query.recordUnit)
    ) {
      score += 8;
      reasons.push(`unit compatible (${f.inputUnit})`);
    }
  }

  // Fuel / transport / refrigerant detail: substring match against the
  // factor's identifying text.
  if (query.matchHint) {
    const haystack = [f.externalId, f.activityType, f.usageNotes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const hints = query.matchHint
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
    const matched = hints.filter((token) => haystack.includes(token));
    if (matched.length > 0) {
      score += 4;
      reasons.push(`detail matched "${matched.join(", ")}"`);
    }
  }

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

// Deterministic ordering: score first, then a stable id tie-break so the
// same inputs always select the same factor regardless of DB row order.
function rankCandidates(
  candidates: EmissionFactor[],
  query: FactorQuery,
): { factor: EmissionFactor; score: number; reason: string }[] {
  return candidates
    .map((f) => ({ factor: f, ...scoreCandidate(f, query) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.factor.externalId ?? a.factor.id).localeCompare(
          b.factor.externalId ?? b.factor.id,
        ),
    );
}

export async function selectFactor(
  query: FactorQuery,
  cache?: FactorCache,
): Promise<FactorSelection | null> {
  let candidates: EmissionFactor[];

  if (cache) {
    const key = `${query.factorLibraryId}:${query.emissionCategoryId}`;
    const bucket = cache.get(key) ?? [];
    candidates = bucket.filter((f) => {
      const startOk = !f.effectiveStartDate || f.effectiveStartDate <= query.activityDate;
      const endOk = !f.effectiveEndDate || f.effectiveEndDate >= query.activityDate;
      return startOk && endOk;
    });
  } else {
    candidates = await prisma.emissionFactor.findMany({
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
  }

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
      const best = rankCandidates(marketCandidates, query)[0];
      return {
        factor: best.factor,
        selectionReason: `market-based: ${best.reason}`,
        warnings: [],
      };
    }

    // No market-based factor found — fall back to location-based with warning
    const best = rankCandidates(candidates, query)[0];
    return {
      factor: best.factor,
      selectionReason: `location-based fallback: ${best.reason}`,
      warnings: ["No market-based factor found, using location-based as fallback."],
    };
  }

  const best = rankCandidates(candidates, query)[0];

  return { factor: best.factor, selectionReason: best.reason, warnings: [] };
}
