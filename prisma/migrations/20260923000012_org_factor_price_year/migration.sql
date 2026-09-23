-- Organisation factors: price year for spend-based factors, as library factors have. Additive.
ALTER TABLE "organization_emission_factors" ADD COLUMN IF NOT EXISTS "price_base_year" INTEGER;
