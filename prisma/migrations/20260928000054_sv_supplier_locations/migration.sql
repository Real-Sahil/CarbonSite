-- CreateTable
CREATE TABLE "sv_supplier_locations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "sme" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sv_supplier_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sv_supplier_locations_organization_id_name_key_key" ON "sv_supplier_locations"("organization_id", "name_key");

-- AddForeignKey
ALTER TABLE "sv_supplier_locations" ADD CONSTRAINT "sv_supplier_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row level security: the app connects as postgres (bypasses RLS); no other role gets access.
ALTER TABLE "sv_supplier_locations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sv_supplier_locations_deny_all" ON "sv_supplier_locations" FOR ALL USING (false) WITH CHECK (false);
