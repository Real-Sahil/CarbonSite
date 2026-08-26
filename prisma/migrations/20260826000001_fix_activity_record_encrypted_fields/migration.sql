-- Fix: previous migration added wrong column name to activity_records.
-- Schema requires pickup_postcode_encrypted and delivery_postcode_encrypted;
-- the previous migration incorrectly added postcode_encrypted instead.
ALTER TABLE "activity_records"
  ADD COLUMN IF NOT EXISTS "pickup_postcode_encrypted" JSONB,
  ADD COLUMN IF NOT EXISTS "delivery_postcode_encrypted" JSONB;
