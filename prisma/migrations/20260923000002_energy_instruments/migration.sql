-- Contractual instruments for market-based Scope 2 (REGOs, Guarantees of
-- Origin, PPAs, green tariffs, supplier emission rates, residual mix).
-- Additive only.

-- CreateEnum
CREATE TYPE "energy_instrument_type" AS ENUM ('rego', 'guarantee_of_origin', 'ppa', 'green_tariff', 'supplier_specific', 'residual_mix');

-- CreateTable
CREATE TABLE "energy_instruments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "facility_id" TEXT,
    "type" "energy_instrument_type" NOT NULL,
    "supplier_name" TEXT,
    "reference" TEXT,
    "covered_kwh" DECIMAL(20,4),
    "emission_factor_kg_per_kwh" DECIMAL(12,6) NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "evidence_file_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "energy_instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "energy_instruments_organization_id_valid_from_idx" ON "energy_instruments"("organization_id", "valid_from");

-- AddForeignKey
ALTER TABLE "energy_instruments" ADD CONSTRAINT "energy_instruments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_instruments" ADD CONSTRAINT "energy_instruments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "energy_instruments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "energy_instruments_deny_all" ON "energy_instruments" FOR ALL USING (false) WITH CHECK (false);
