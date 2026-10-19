// PACT Scope 3 category names → seeded MetricOra category codes (prisma/seed.ts).
// Returns null for an unknown name so the caller decides; a code that is not seeded matches nothing.
const PACT_TO_CATEGORY = new Map<string, string>([
  ["purchased-goods-services", "s3-purchased-goods"],
  ["capital-goods", "s3-capital-goods"],
  ["fuel-energy-not-included-in-scope", "s3-fuel-energy"],
  ["upstream-transportation-distribution", "s3-upstream-transport"],
  ["waste-generated-operations", "s3-waste"],
  ["business-travel", "s3-business-travel"],
  ["employee-commuting", "s3-commuting"],
  ["upstream-leased-assets", "s3-upstream-leased"],
  ["downstream-transportation-distribution", "s3-downstream-transport"],
  ["processing-sold-products", "s3-processing-sold"],
  ["use-sold-products", "s3-use-sold"],
  ["end-of-life-sold-products", "s3-end-of-life"],
  ["downstream-leased-assets", "s3-downstream-leased"],
  ["franchises", "s3-franchises"],
  ["investments", "s3-investments"],
]);

export function mapPactCategoryToInternal(pactCategory: string): string | null {
  return PACT_TO_CATEGORY.get(pactCategory) ?? null;
}
