-- Add encrypted postcode fields to models that store location data
-- Stores: { iv: "base64-encoded-IV", ciphertext: "base64-encoded-ciphertext+authtag" }
-- Plaintext fields remain for database lookups (unique constraints, indexes)

-- PostcodeGeocode: encrypted versions of normalized_postcode and display_postcode
ALTER TABLE "postcode_geocodes" ADD COLUMN IF NOT EXISTS "normalized_postcode_encrypted" JSONB,
ADD COLUMN IF NOT EXISTS "display_postcode_encrypted" JSONB;

-- RouteDistance: encrypted versions of pickup/delivery postcodes
ALTER TABLE "route_distances" ADD COLUMN IF NOT EXISTS "pickup_postcode_encrypted" JSONB,
ADD COLUMN IF NOT EXISTS "delivery_postcode_encrypted" JSONB;

-- FieldSubmission: encrypted versions of pickup/delivery postcodes
ALTER TABLE "field_submissions" ADD COLUMN IF NOT EXISTS "pickup_postcode_encrypted" JSONB,
ADD COLUMN IF NOT EXISTS "delivery_postcode_encrypted" JSONB;

-- ActivityRecord: encrypted version of postcode
DO $$
BEGIN
  ALTER TABLE "activity_records" ADD COLUMN IF NOT EXISTS "postcode_encrypted" JSONB;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
