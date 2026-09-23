-- Supplier industry code (6-digit NAICS or UK SIC) for spend-based factors
-- priced by industry (EPA USEEIO v1.3). Additive, nullable.
ALTER TABLE "activity_records" ADD COLUMN     "industry_code" TEXT;
