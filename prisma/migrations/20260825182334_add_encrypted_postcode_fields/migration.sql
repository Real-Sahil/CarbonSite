-- Add encrypted postcode fields to models that store location data
-- Stores: { iv: "base64-encoded-IV", ciphertext: "base64-encoded-ciphertext+authtag" }
-- Plaintext fields remain for database lookups (unique constraints, indexes)

-- PostcodeGeocode: encrypted versions of normalized_postcode and display_postcode
ALTER TABLE "postcode_geocodes" ADD COLUMN "normalized_postcode_encrypted" JSONB,
ADD COLUMN "display_postcode_encrypted" JSONB;

-- WasteTicket: encrypted versions of pickup/delivery postcodes
ALTER TABLE "waste_tickets" ADD COLUMN "pickup_postcode_encrypted" JSONB,
ADD COLUMN "delivery_postcode_encrypted" JSONB;

-- RouteDistance: encrypted versions of pickup/delivery postcodes
ALTER TABLE "route_distances" ADD COLUMN "pickup_postcode_encrypted" JSONB,
ADD COLUMN "delivery_postcode_encrypted" JSONB;

-- FieldSubmission: encrypted versions of pickup/delivery postcodes
ALTER TABLE "field_submissions" ADD COLUMN "pickup_postcode_encrypted" JSONB,
ADD COLUMN "delivery_postcode_encrypted" JSONB;

-- ActivityRecord: encrypted version of postcode
ALTER TABLE "activity_records" ADD COLUMN "postcode_encrypted" JSONB;
