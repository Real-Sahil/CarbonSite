-- A calculation that used the org's own factor (organization_emission_factors)
-- records it here; emission_factor_id stays for the shared library. Additive.

-- AlterTable
ALTER TABLE "emission_calculations" ADD COLUMN IF NOT EXISTS "organization_emission_factor_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "emission_calculations_organization_emission_factor_id_idx" ON "emission_calculations"("organization_emission_factor_id");

-- AddForeignKey
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'emission_calculations_organization_emission_factor_id_fkey') THEN
    ALTER TABLE "emission_calculations" ADD CONSTRAINT "emission_calculations_organization_emission_factor_id_fkey" FOREIGN KEY ("organization_emission_factor_id") REFERENCES "organization_emission_factors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$do$;
