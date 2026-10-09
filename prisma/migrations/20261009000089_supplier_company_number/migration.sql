-- AlterTable
ALTER TABLE "sv_supplier_locations" ADD COLUMN     "alias_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "company_check" JSONB,
ADD COLUMN     "company_number" TEXT;

-- CreateIndex
CREATE INDEX "sv_supplier_locations_organization_id_company_number_idx" ON "sv_supplier_locations"("organization_id", "company_number");

