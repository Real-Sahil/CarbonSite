-- ============================================================
-- CarbonSite: Production Seed Data
-- Run this AFTER production-setup-migration.sql
-- Run in the Neon SQL editor (console.neon.tech → SQL Editor)
-- SAFE TO RUN MULTIPLE TIMES — uses ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── Methodology version ─────────────────────────────────────────────────────

INSERT INTO "methodology_versions" ("id", "name", "gwp_version", "notes", "created_at")
VALUES (
  gen_random_uuid()::text,
  'ghg-protocol-v2026-01',
  'AR6',
  'GHG Protocol Corporate Standard, GWP values from IPCC AR6',
  NOW()
)
ON CONFLICT ("name") DO NOTHING;

-- ─── Emission categories ─────────────────────────────────────────────────────
-- Note: emission_categories has no created_at/updated_at columns.

INSERT INTO "emission_categories" ("id", "scope", "code", "name", "activity_type")
VALUES
  (gen_random_uuid()::text, 1, 's1-stationary',        'Stationary Combustion',                          'stationary_combustion'),
  (gen_random_uuid()::text, 1, 's1-mobile',             'Mobile Combustion',                              'mobile_combustion'),
  (gen_random_uuid()::text, 1, 's1-fugitive',           'Fugitive Emissions (Refrigerants)',              'fugitive_refrigerants'),
  (gen_random_uuid()::text, 2, 's2-electricity-lb',     'Purchased Electricity (Location-Based)',         'purchased_electricity_location'),
  (gen_random_uuid()::text, 2, 's2-electricity-mb',     'Purchased Electricity (Market-Based)',           'purchased_electricity_market'),
  (gen_random_uuid()::text, 3, 's3-business-travel',    'Business Travel',                                'business_travel'),
  (gen_random_uuid()::text, 3, 's3-commuting',          'Employee Commuting',                             'employee_commuting'),
  (gen_random_uuid()::text, 3, 's3-purchased-goods',    'Purchased Goods & Services',                     'purchased_goods_spend'),
  (gen_random_uuid()::text, 3, 's3-upstream-transport', 'Upstream Transportation & Distribution',         'upstream_transport'),
  (gen_random_uuid()::text, 3, 's3-waste',              'Waste Generated in Operations',                  'waste_disposal')
ON CONFLICT ("code") DO NOTHING;

-- ─── Factor libraries ─────────────────────────────────────────────────────────
-- Note: factor_libraries has no updated_at column.

INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
VALUES
  (gen_random_uuid()::text, 'DEFRA', '2025.1',
   'Open Government Licence v3.0',
   'https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting',
   '2025-06-01', NOW()),
  (gen_random_uuid()::text, 'EPA', '2025.1',
   'Public Domain (US Government Work)',
   'https://www.epa.gov/climateleadership/ghg-emission-factors-hub',
   '2025-01-01', NOW())
ON CONFLICT ("name", "version") DO NOTHING;

-- ─── Emission factors (DEFRA 2025 + EPA 2025) ────────────────────────────────
-- Inserted by external_id; skipped if already present.

DO $$
DECLARE
  defra_id TEXT;
  epa_id   TEXT;
  cat      RECORD;
BEGIN
  SELECT id INTO defra_id FROM factor_libraries WHERE name='DEFRA' AND version='2025.1';
  SELECT id INTO epa_id   FROM factor_libraries WHERE name='EPA'   AND version='2025.1';

  -- Helper: get category id by code
  -- (inline below using subselects for compatibility)

  -- SCOPE 1: STATIONARY COMBUSTION (DEFRA 2025 GB)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2, ch4, n2o, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-natgas-kwh', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','kWh',
    0.18256,0.00000824,0.00000037,NULL,
    'Natural gas, gross CV. DEFRA 2025 conversion factors.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-natgas-kwh');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-burning-oil-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','litre',2.54039,
    'Burning oil (kerosene for heating). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-burning-oil-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-lpg-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','litre',1.55709,
    'LPG (butane/propane mix), commercial. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-lpg-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-gasoil-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','litre',2.76476,
    'Gas oil (red diesel for stationary engines/heating). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-gasoil-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-heavyfueloil-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','litre',3.17997,
    'Heavy fuel oil (bunker, marine fuel oil). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-heavyfueloil-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-diesel-stationary-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','litre',2.69364,
    'Diesel for stationary generators. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-diesel-stationary-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-coal-industrial-kg', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','kg',2.42310,
    'Industrial coal. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-coal-industrial-kg');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-wood-chips-kg', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','kg',0.01540,
    'Wood chips (biomass boiler). Biogenic CO2 excluded per GHG Protocol. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-wood-chips-kg');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-wood-pellets-kg', 1,
    (SELECT id FROM emission_categories WHERE code='s1-stationary'),
    'stationary_combustion','GB','2025-01-01','2026-12-31','kg',0.01539,
    'Wood pellets (biomass boiler). Biogenic CO2 excluded. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-wood-pellets-kg');

  -- SCOPE 1: MOBILE COMBUSTION (DEFRA 2025 GB)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2, ch4, n2o, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-diesel-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','GB','2025-01-01','2026-12-31','litre',
    2.49846,0.00002330,0.00004840,NULL,
    'Diesel, average biofuel blend for road vehicles. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-diesel-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-petrol-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','GB','2025-01-01','2026-12-31','litre',2.09767,
    'Petrol, average biofuel blend. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-petrol-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-cng-kg', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','GB','2025-01-01','2026-12-31','kg',2.54282,
    'Compressed natural gas (CNG) for vehicles. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-cng-kg');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-lng-kg', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','GB','2025-01-01','2026-12-31','kg',2.75253,
    'Liquefied natural gas (LNG) for HGVs. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-lng-kg');

  -- SCOPE 2: ELECTRICITY (DEFRA 2025 GB grid)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-electricity-lb-kwh', 2,
    (SELECT id FROM emission_categories WHERE code='s2-electricity-lb'),
    'purchased_electricity_location','GB','2025-01-01','2026-12-31','kWh',0.20493,
    'UK grid electricity, location-based. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-electricity-lb-kwh');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-electricity-mb-kwh', 2,
    (SELECT id FROM emission_categories WHERE code='s2-electricity-mb'),
    'purchased_electricity_market','GB','2025-01-01','2026-12-31','kWh',0.20493,
    'UK grid electricity, market-based (use supplier-specific if available). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-electricity-mb-kwh');

  -- SCOPE 3: BUSINESS TRAVEL (DEFRA 2025)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-car-average-km', 3,
    (SELECT id FROM emission_categories WHERE code='s3-business-travel'),
    'business_travel','GB','2025-01-01','2026-12-31','km',0.17097,
    'Average car (petrol+diesel mix). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-car-average-km');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-rail-uk-km', 3,
    (SELECT id FROM emission_categories WHERE code='s3-business-travel'),
    'business_travel','GB','2025-01-01','2026-12-31','km',0.03549,
    'UK domestic rail (national average). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-rail-uk-km');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-air-short-haul-km', 3,
    (SELECT id FROM emission_categories WHERE code='s3-business-travel'),
    'business_travel','GB','2025-01-01','2026-12-31','km',0.15553,
    'Short-haul flight (economy, <3700km). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-air-short-haul-km');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-air-long-haul-km', 3,
    (SELECT id FROM emission_categories WHERE code='s3-business-travel'),
    'business_travel','GB','2025-01-01','2026-12-31','km',0.19085,
    'Long-haul flight (economy, >3700km). DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-air-long-haul-km');

  -- SCOPE 3: WASTE (DEFRA 2025)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-waste-landfill-mixed-kg', 3,
    (SELECT id FROM emission_categories WHERE code='s3-waste'),
    'waste_disposal','GB','2025-01-01','2026-12-31','kg',0.44700,
    'Mixed waste, landfill disposal. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-waste-landfill-mixed-kg');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-waste-recycled-mixed-kg', 3,
    (SELECT id FROM emission_categories WHERE code='s3-waste'),
    'waste_disposal','GB','2025-01-01','2026-12-31','kg',0.02138,
    'Mixed waste, recycling. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-waste-recycled-mixed-kg');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, defra_id, 'defra-2025-waste-incineration-kg', 3,
    (SELECT id FROM emission_categories WHERE code='s3-waste'),
    'waste_disposal','GB','2025-01-01','2026-12-31','kg',0.02096,
    'Mixed waste, incineration with energy recovery. DEFRA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=defra_id AND external_id='defra-2025-waste-incineration-kg');

  -- EPA 2025 factors (US)
  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, epa_id, 'epa-2025-electricity-us-kwh', 2,
    (SELECT id FROM emission_categories WHERE code='s2-electricity-lb'),
    'purchased_electricity_location','US','2025-01-01','2026-12-31','kWh',0.38600,
    'US national average grid electricity. EPA 2025.'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=epa_id AND external_id='epa-2025-electricity-us-kwh');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, epa_id, 'epa-2025-diesel-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','US','2025-01-01','2026-12-31','litre',2.70534,
    'Diesel fuel. EPA GHG Emission Factors Hub 2025 (converted from per gallon).'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=epa_id AND external_id='epa-2025-diesel-litre');

  INSERT INTO emission_factors (id, factor_library_id, external_id, scope, emission_category_id, activity_type, geography_country, effective_start_date, effective_end_date, input_unit, co2e, usage_notes)
  SELECT gen_random_uuid()::text, epa_id, 'epa-2025-petrol-litre', 1,
    (SELECT id FROM emission_categories WHERE code='s1-mobile'),
    'mobile_combustion','US','2025-01-01','2026-12-31','litre',2.34658,
    'Gasoline (petrol). EPA GHG Emission Factors Hub 2025 (converted from per gallon).'
  WHERE NOT EXISTS (SELECT 1 FROM emission_factors WHERE factor_library_id=epa_id AND external_id='epa-2025-petrol-litre');

END $$;

-- ─── TOMS Social Value themes ─────────────────────────────────────────────────

INSERT INTO "social_value_themes" ("id", "code", "name", "sort_order")
VALUES
  (gen_random_uuid()::text, 'T1', 'Jobs & Skills', 1),
  (gen_random_uuid()::text, 'T2', 'Supporting Growth & Equal Opportunities', 2),
  (gen_random_uuid()::text, 'T3', 'Healthier, Safer & More Resilient Communities', 3),
  (gen_random_uuid()::text, 'T4', 'Decarbonisation & Protecting the Environment', 4),
  (gen_random_uuid()::text, 'T5', 'Promoting Social Innovation', 5)
ON CONFLICT ("code") DO NOTHING;

-- ─── TOMS measures ────────────────────────────────────────────────────────────

INSERT INTO "social_value_measures" ("id", "theme_id", "toms_code", "name", "unit", "value_per_unit", "active")
SELECT gen_random_uuid()::text, t.id, m.toms_code, m.name, m.unit, m.value_per_unit, true
FROM (VALUES
  ('T1','T1/M1','Local People in Employment','FTE',13220),
  ('T1','T1/M2','Local Apprenticeship Starts','starts',17680),
  ('T1','T1/M3','Paid Employment for Disadvantaged Groups','FTE',26440),
  ('T1','T1/M4','Training Days Provided','days',215),
  ('T1','T1/M5','Work Experience Weeks','weeks',320),
  ('T2','T2/M1','Local Supply Chain Spend','£',0.06),
  ('T2','T2/M2','SME Supply Chain Spend','£',0.06),
  ('T2','T2/M3','Social Enterprise / Voluntary Sector Spend','£',0.06),
  ('T3','T3/M1','Volunteering Days by Employees','days',145),
  ('T3','T3/M2','Community Investment','£',1),
  ('T3','T3/M3','Health & Wellbeing Activities','participants',110),
  ('T4','T4/M1','CO2e Reduced','tCO2e',40),
  ('T4','T4/M2','Waste Diverted from Landfill','tonnes',55),
  ('T4','T4/M3','Renewable Energy Generated On-Site','kWh',0.04),
  ('T5','T5/M1','Innovation Activities Delivered','activities',2500),
  ('T5','T5/M2','Digital Skills Training','participants',530)
) AS m(theme_code, toms_code, name, unit, value_per_unit)
JOIN social_value_themes t ON t.code = m.theme_code
ON CONFLICT ("toms_code") DO NOTHING;

-- ─── Embodied carbon materials (ICE v3.0) ────────────────────────────────────

INSERT INTO "embodied_materials" ("id","name","category","gwp_a1_a3","gwp_a4","declared_unit","density","source","created_at","updated_at")
VALUES
  -- Concrete & cement
  (gen_random_uuid()::text,'General Purpose Cement (CEM I)','concrete',0.82,0.008,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Ready Mix Concrete (25 MPa, 300 kg/m3 cement)','concrete',0.11,0.006,'kg',2400,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Precast Concrete Panel','concrete',0.16,0.010,'kg',2400,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Reinforced Concrete (slab, 250mm)','concrete',0.132,0.007,'kg',2500,'ICE v3.0',NOW(),NOW()),
  -- Steel
  (gen_random_uuid()::text,'Structural Steel (virgin, UK EAF)','steel',1.77,0.020,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Structural Steel (recycled content, UK EAF)','steel',0.51,0.020,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Reinforcing Bar (rebar, recycled)','steel',0.55,0.018,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Cold-Rolled Steel Sheet','steel',2.11,0.021,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Stainless Steel 304','steel',6.15,0.025,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  -- Timber
  (gen_random_uuid()::text,'Sawn Softwood Timber (kiln dried)','timber',0.263,0.015,'kg',470,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Glued Laminated Timber (Glulam)','timber',0.512,0.015,'kg',480,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Cross-Laminated Timber (CLT)','timber',0.437,0.015,'kg',490,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Plywood','timber',0.72,0.018,'kg',530,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Oriented Strand Board (OSB)','timber',0.45,0.015,'kg',600,'ICE v3.0',NOW(),NOW()),
  -- Masonry
  (gen_random_uuid()::text,'Dense Aggregate Block','masonry',0.073,0.010,'kg',2100,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Aerated Concrete Block (AAC)','masonry',0.38,0.009,'kg',650,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Facing Brick','masonry',0.22,0.010,'kg',1900,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Concrete Roof Tile','masonry',0.096,0.008,'kg',2000,'ICE v3.0',NOW(),NOW()),
  -- Insulation
  (gen_random_uuid()::text,'Mineral Wool (glass)','insulation',1.28,0.018,'kg',25,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Mineral Wool (rock)','insulation',1.12,0.018,'kg',40,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Expanded Polystyrene (EPS)','insulation',3.29,0.012,'kg',20,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Extruded Polystyrene (XPS)','insulation',4.66,0.012,'kg',35,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Rigid PIR / PUR Board','insulation',4.49,0.011,'kg',32,'ICE v3.0',NOW(),NOW()),
  -- Glass
  (gen_random_uuid()::text,'Float Glass','glass',0.91,0.025,'kg',2500,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Double-Glazed Unit (standard low-e)','glass',28.0,0.900,'m2',NULL,'ICE v3.0',NOW(),NOW()),
  -- Aluminium
  (gen_random_uuid()::text,'Aluminium (primary, smelted)','aluminium',11.46,0.025,'kg',2700,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Aluminium (recycled, UK)','aluminium',1.69,0.025,'kg',2700,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Aluminium Curtain Walling','aluminium',52.0,1.200,'m2',NULL,'ICE v3.0',NOW(),NOW()),
  -- Finishes
  (gen_random_uuid()::text,'Plasterboard (standard)','finishes',0.39,0.010,'kg',800,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Gypsum Plaster','finishes',0.12,0.009,'kg',NULL,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Ceramic Floor Tile','finishes',0.73,0.012,'kg',2000,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'Carpet (nylon, broadloom)','finishes',5.30,0.032,'kg',2,'ICE v3.0',NOW(),NOW()),
  -- Services & MEP
  (gen_random_uuid()::text,'Copper Pipe','services',3.77,0.020,'kg',8900,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'PVC-U Pipe','services',2.41,0.018,'kg',1400,'ICE v3.0',NOW(),NOW()),
  (gen_random_uuid()::text,'HDPE Pipe','services',2.12,0.016,'kg',950,'ICE v3.0',NOW(),NOW())
ON CONFLICT ("name") DO NOTHING;

-- ─── SEED COMPLETE ────────────────────────────────────────────────────────────
-- Emission categories, factor libraries, DEFRA/EPA emission factors,
-- TOMS social value themes & measures, and 35 ICE v3.0 embodied materials
-- have been seeded. Your platform is ready to use.
