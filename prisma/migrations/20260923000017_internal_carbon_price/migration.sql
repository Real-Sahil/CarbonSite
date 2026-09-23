-- Internal carbon prices (ESRS E1-8), one row per price version per organisation.
-- CreateTable
CREATE TABLE "internal_carbon_prices" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_type" TEXT NOT NULL,
    "price_per_tonne" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "scopes" INTEGER[],
    "applies_to" TEXT[],
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "basis" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_carbon_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internal_carbon_prices_organization_id_effective_from_idx" ON "internal_carbon_prices"("organization_id", "effective_from");

-- AddForeignKey
ALTER TABLE "internal_carbon_prices" ADD CONSTRAINT "internal_carbon_prices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- E1-8 can now be answered from data.
UPDATE "framework_datapoints" SET "resolver_key" = 'internal_carbon_price'
WHERE "framework" = 'esrs_e1' AND "code" = 'E1-8' AND "resolver_key" IS NULL;

-- Deny-all, like every tenant table: only the app (postgres, bypasses RLS) may touch it.
ALTER TABLE "internal_carbon_prices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_carbon_prices_deny_all" ON "internal_carbon_prices" FOR ALL USING (false) WITH CHECK (false);
