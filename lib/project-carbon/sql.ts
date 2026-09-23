import { Prisma } from "@prisma/client";

/**
 * Raw-SQL twin of countsTowardHeadline(scope2MethodOf(record)) for queries
 * over `activity_records ar` joined to `emission_categories cat`: false only
 * for market-based Scope 2, which is reported beside the location-based
 * figure and never added to it. True when the record row is absent (LEFT
 * JOINs), so a contract with no records still appears.
 */
export const HEADLINE_ONLY = Prisma.sql`COALESCE(NOT (
  cat.scope = 2 AND COALESCE(
    ar.scope2_method::text,
    CASE WHEN cat.code = 's2-electricity-mb' THEN 'market_based' ELSE 'location_based' END
  ) = 'market_based'
), TRUE)`;
