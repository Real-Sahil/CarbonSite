-- Duty-of-care fields for the waste transfer register. Nullable, additive.
-- AlterTable
ALTER TABLE "waste_records" ADD COLUMN     "carrier_registration" TEXT,
ADD COLUMN     "destination" TEXT,
ADD COLUMN     "transfer_note_reference" TEXT,
ADD COLUMN     "vehicle_registration" TEXT;

