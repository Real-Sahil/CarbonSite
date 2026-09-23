-- Price year of spend-based factors, so spend can be adjusted for inflation.
-- Nullable and additive.
-- AlterTable
ALTER TABLE "emission_factors" ADD COLUMN     "price_base_year" INTEGER;

