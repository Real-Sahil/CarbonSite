-- Embodied carbon library: aggregates and asphalt, the commonest civils
-- deliveries, which had no factor. Values are DEFRA 2025 "Material use"
-- factors (kg CO2e per tonne, stored per kg). Shared reference data; seed.ts
-- carries the same rows for fresh databases.
INSERT INTO "embodied_materials" ("id", "name", "category", "gwp_a1_a3", "declared_unit", "source", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'Aggregates (primary)', 'aggregates', 0.00779306, 'kg', 'DEFRA 2025 Material use: Aggregates, primary material production (7.79306 kg CO2e/t)', NOW(), NOW()),
  (gen_random_uuid()::text, 'Aggregates (recycled)', 'aggregates', 0.00321835, 'kg', 'DEFRA 2025 Material use: Aggregates, closed-loop source (3.21835 kg CO2e/t)', NOW(), NOW()),
  (gen_random_uuid()::text, 'Asphalt (primary)', 'asphalt', 0.03921249, 'kg', 'DEFRA 2025 Material use: Asphalt, primary material production (39.21249 kg CO2e/t)', NOW(), NOW()),
  (gen_random_uuid()::text, 'Asphalt (recycled content)', 'asphalt', 0.02867835, 'kg', 'DEFRA 2025 Material use: Asphalt, closed-loop source (28.67835 kg CO2e/t)', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- Carpet was seeded with a density of 2 kg/m3, which is not a carpet density
-- and would turn any m3 quantity into near-zero mass. Unknown is safer.
UPDATE "embodied_materials" SET "density" = NULL, "updated_at" = NOW()
WHERE "name" = 'Carpet (nylon, broadloom)' AND "density" = 2;
