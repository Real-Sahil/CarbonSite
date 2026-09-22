// Builds prisma/data/defra-2026-factors.json from the DESNZ/DEFRA
// "Conversion factors 2026: flat file (for automatic processing only)" v1.2
// (revised July 2026). Usage:
//   node scripts/build-defra-2026-factors.mjs path/to/ghg-conversion-factors-2026-flat-format.xlsx
// Every factor this platform uses in the DEFRA 2025.1 library is mapped to
// the DEFRA 2026 row that means the same thing. Rows DEFRA does not publish
// (IPCC AR6 refrigerant GWPs, EEIO spend factors, the Irish grid, the UK
// residual mix, electric taxis, cycling) are carried forward from 2025.1 by
// the migration and flagged in their usage notes.
import { mkdirSync, writeFileSync } from "node:fs";
import XLSX from "xlsx";

const [, , source] = process.argv;
if (!source) throw new Error("Pass the path to the DEFRA 2026 flat-file XLSX.");

const wb = XLSX.readFile(source);
const front = XLSX.utils.sheet_to_json(wb.Sheets["Front page"], { header: 1 });
const version = front.find((r) => r[1] === "Version:")?.[2];
if (String(version) !== "1.2") throw new Error(`Expected flat file version 1.2, got ${version}`);

const rows = XLSX.utils
  .sheet_to_json(wb.Sheets["Factors by Category"], { header: 1, blankrows: false })
  .slice(5)
  .filter((r) => r[8] === "kg CO2e")
  .map((r) => ({ id: r[0], l1: r[2], l2: r[3], l3: r[4], l4: r[5] ?? "", col: r[6] ?? "", uom: r[7], v: r[9] }));

function row(l1, l2, l3, col, uom, l4 = "") {
  const hits = rows.filter(
    (r) => r.l1 === l1 && r.l2 === l2 && r.l3 === l3 && r.l4 === l4 && r.col === col && r.uom === uom,
  );
  if (hits.length !== 1 || typeof hits[0].v !== "number") {
    throw new Error(`Expected one numeric row for ${[l1, l2, l3, l4, col, uom].join(" | ")}, found ${hits.length}`);
  }
  return hits[0];
}

const PV = "Passenger vehicles", DV = "Delivery vehicles", EV = "UK electricity for EVs";
const FUEL = "Fuels", BIO = "Bioenergy", LAND = "Business travel- land", AIR = "Business travel- air";
const FR = "Freighting goods", WASTE = "Waste disposal";
const car = (l1, size, fuel) => row(l1, "Cars (by size)", size, fuel, "km");
const flight = (haul, cls) => row(AIR, "Flights", haul, "With RF", "passenger.km", cls);
const hgv = (l3) => row(FR, "HGV (non-refrigerated, all diesel)", l3, "Average laden", "tonne.km");
const waste = (l2, l3, route) => row(WASTE, l2, l3, route, "tonnes");

// [externalId suffix, category, activityType, inputUnit, geography, source rows, divisor, note]
const SPEC = [
  ["car-avg-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Average car", "Unknown")], 1, "Car, average size, unknown fuel, per vehicle.km."],
  ["car-bev-medium-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(EV, "Medium car", "Battery Electric Vehicle")], 1, "Medium BEV, UK grid charging (DEFRA 'UK electricity for EVs'), per vehicle.km."],
  ["car-diesel-large-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Large car", "Diesel")], 1, "Large diesel car, per vehicle.km."],
  ["car-diesel-medium-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Medium car", "Diesel")], 1, "Medium diesel car, per vehicle.km."],
  ["car-diesel-small-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Small car", "Diesel")], 1, "Small diesel car, per vehicle.km."],
  ["car-petrol-large-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Large car", "Petrol")], 1, "Large petrol car, per vehicle.km."],
  ["car-petrol-medium-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Medium car", "Petrol")], 1, "Medium petrol car, per vehicle.km."],
  ["car-petrol-small-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Small car", "Petrol")], 1, "Small petrol car, per vehicle.km."],
  ["car-phev-avg-km", "s1-mobile", "mobile_combustion_car", "km", "GB", [car(PV, "Average car", "Plug-in Hybrid Electric Vehicle"), car(EV, "Average car", "Plug-in Hybrid Electric Vehicle")], 1, "Average PHEV: fuel plus UK grid charging, per vehicle.km."],
  ["cng-kg", "s1-mobile", "mobile_combustion", "kg", "GB", [row(FUEL, "Gaseous fuels", "CNG", "", "tonnes")], 1000, "CNG, per kg."],
  ["diesel-litre", "s1-mobile", "mobile_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Diesel (average biofuel blend)", "", "litres")], 1, "Diesel, average biofuel blend."],
  ["hvo-litre", "s1-mobile", "mobile_combustion", "litre", "GB", [row(BIO, "Biofuel", "Biodiesel HVO", "", "litres")], 1, "HVO. Biogenic CO2 reported outside of scopes."],
  ["lng-kg", "s1-mobile", "mobile_combustion", "kg", "GB", [row(FUEL, "Gaseous fuels", "LNG", "", "tonnes")], 1000, "LNG, per kg."],
  ["motorbike-avg-km", "s1-mobile", "mobile_combustion_motorbike", "km", "GB", [row(PV, "Motorbike", "Average", "", "km")], 1, "Motorbike, average, per vehicle.km."],
  ["petrol-litre", "s1-mobile", "mobile_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Petrol (average biofuel blend)", "", "litres")], 1, "Petrol, average biofuel blend."],
  ["van-diesel-km", "s1-mobile", "mobile_combustion_van", "km", "GB", [row(DV, "Vans", "Average (up to 3.5 tonnes)", "Diesel", "km")], 1, "Van up to 3.5t, diesel, per vehicle.km."],
  ["van-electric-km", "s1-mobile", "mobile_combustion_van", "km", "GB", [row(EV, "Vans", "Average (up to 3.5 tonnes)", "Battery Electric Vehicle", "km")], 1, "Electric van up to 3.5t, UK grid charging, per vehicle.km."],
  ["burning-oil-litre", "s1-stationary", "stationary_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Burning oil", "", "litres")], 1, "Burning oil (kerosene)."],
  ["coal-industrial-kg", "s1-stationary", "stationary_combustion", "kg", "GB", [row(FUEL, "Solid fuels", "Coal (industrial)", "", "tonnes")], 1000, "Industrial coal, per kg."],
  ["diesel-stationary-litre", "s1-stationary", "stationary_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Diesel (100% mineral diesel)", "", "litres")], 1, "Diesel (100% mineral) for stationary generators."],
  ["gasoil-litre", "s1-stationary", "stationary_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Gas oil", "", "litres")], 1, "Gas oil."],
  ["heavyfueloil-litre", "s1-stationary", "stationary_combustion", "litre", "GB", [row(FUEL, "Liquid fuels", "Fuel oil", "", "litres")], 1, "Fuel oil."],
  ["lpg-litre", "s1-stationary", "stationary_combustion", "litre", "GB", [row(FUEL, "Gaseous fuels", "LPG", "", "litres")], 1, "LPG."],
  ["natgas-kwh", "s1-stationary", "stationary_combustion", "kWh", "GB", [row(FUEL, "Gaseous fuels", "Natural gas", "", "kWh (Gross CV)")], 1, "Natural gas, gross CV."],
  ["wood-chips-kg", "s1-stationary", "stationary_combustion", "kg", "GB", [row(BIO, "Biomass", "Wood chips", "", "tonnes")], 1000, "Wood chips, per kg. Biogenic CO2 outside of scopes."],
  ["wood-pellets-kg", "s1-stationary", "stationary_combustion", "kg", "GB", [row(BIO, "Biomass", "Wood pellets", "", "tonnes")], 1000, "Wood pellets, per kg. Biogenic CO2 outside of scopes."],
  ["elec-uk-lb-kwh", "s2-electricity-lb", "purchased_electricity_location", "kWh", "GB", [row("UK electricity", "Electricity generated", "Electricity: UK", "", "kWh", "kWh")], 1, "UK grid electricity generated, location-based."],
  ["electricity-lb-kwh", "s2-electricity-lb", "purchased_electricity_location", "kWh", "GB", [row("UK electricity", "Electricity generated", "Electricity: UK", "", "kWh", "kWh")], 1, "UK grid electricity generated, location-based."],
  ["elec-uk-td-kwh", "s2-electricity-lb", "purchased_electricity_location_td", "kWh", "GB", [row("Transmission and distribution", "T&D- UK electricity", "Electricity: UK", "", "kWh", "kWh")], 1, "UK grid transmission and distribution losses."],
  ["electricity-mb-kwh", "s2-electricity-mb", "purchased_electricity_market", "kWh", "GB", [row("UK electricity", "Electricity generated", "Electricity: UK", "", "kWh", "kWh")], 1, "UK grid average, used for market-based only when no supplier-specific or residual-mix factor applies."],
  ["air-long-haul-km", "s3-business-travel", "business_travel", "km", "GB", [flight("Long-haul, to/from UK", "Economy class")], 1, "Long-haul flight, economy, with radiative forcing, per passenger.km."],
  ["air-short-haul-km", "s3-business-travel", "business_travel", "km", "GB", [flight("Short-haul, to/from UK", "Economy class")], 1, "Short-haul flight, economy, with radiative forcing, per passenger.km."],
  ["biz-bus-local-pkm", "s3-business-travel", "business_travel_bus", "km", "GB", [row(LAND, "Bus", "Average local bus", "", "passenger.km")], 1, "Average local bus, per passenger.km."],
  ["biz-car-avg-km", "s3-business-travel", "business_travel_car", "km", "GB", [car(LAND, "Average car", "Unknown")], 1, "Average car, unknown fuel, per vehicle.km."],
  ["biz-car-bev-km", "s3-business-travel", "business_travel_car_bev", "km", "GB", [car(LAND, "Average car", "Battery Electric Vehicle")], 1, "Average BEV, UK grid charging incl. T&D, per vehicle.km."],
  ["biz-coach-pkm", "s3-business-travel", "business_travel_coach", "km", "GB", [row(LAND, "Bus", "Coach", "", "passenger.km")], 1, "Coach, per passenger.km."],
  ["biz-eurostar-pkm", "s3-business-travel", "business_travel_rail_international", "km", null, [row(LAND, "Rail", "International rail", "", "passenger.km")], 1, "International rail (Eurostar), per passenger.km."],
  ["biz-flight-domestic-econ-pkm", "s3-business-travel", "business_travel_flight_domestic", "km", "GB", [flight("Domestic, to/from UK", "Average passenger")], 1, "UK domestic flight, average passenger, with radiative forcing, per passenger.km."],
  ["biz-flight-longhaul-biz-pkm", "s3-business-travel", "business_travel_flight_longhaul_biz", "km", null, [flight("Long-haul, to/from UK", "Business class")], 1, "Long-haul flight, business class, with radiative forcing, per passenger.km."],
  ["biz-flight-longhaul-econ-pkm", "s3-business-travel", "business_travel_flight_longhaul", "km", null, [flight("Long-haul, to/from UK", "Economy class")], 1, "Long-haul flight, economy, with radiative forcing, per passenger.km."],
  ["biz-flight-longhaul-first-pkm", "s3-business-travel", "business_travel_flight_longhaul_first", "km", null, [flight("Long-haul, to/from UK", "First class")], 1, "Long-haul flight, first class, with radiative forcing, per passenger.km."],
  ["biz-flight-shorthaul-biz-pkm", "s3-business-travel", "business_travel_flight_shorthaul_biz", "km", null, [flight("Short-haul, to/from UK", "Business class")], 1, "Short-haul flight, business class, with radiative forcing, per passenger.km."],
  ["biz-flight-shorthaul-econ-pkm", "s3-business-travel", "business_travel_flight_shorthaul", "km", null, [flight("Short-haul, to/from UK", "Economy class")], 1, "Short-haul flight, economy, with radiative forcing, per passenger.km."],
  ["biz-motorbike-km", "s3-business-travel", "business_travel_motorbike", "km", "GB", [row(LAND, "Motorbike", "Average", "", "km")], 1, "Motorbike, average, per vehicle.km."],
  ["biz-rail-national-pkm", "s3-business-travel", "business_travel_rail", "km", "GB", [row(LAND, "Rail", "National rail", "", "passenger.km")], 1, "National rail, per passenger.km."],
  ["biz-rail-tube-pkm", "s3-business-travel", "business_travel_rail_underground", "km", "GB", [row(LAND, "Rail", "London Underground", "", "passenger.km")], 1, "London Underground, per passenger.km."],
  ["biz-taxi-avg-km", "s3-business-travel", "business_travel_taxi", "km", "GB", [row(LAND, "Taxis", "Regular taxi", "", "passenger.km")], 1, "Regular taxi, per passenger.km."],
  ["car-average-km", "s3-business-travel", "business_travel", "km", "GB", [car(LAND, "Average car", "Unknown")], 1, "Average car, unknown fuel, per vehicle.km."],
  ["rail-uk-km", "s3-business-travel", "business_travel", "km", "GB", [row(LAND, "Rail", "National rail", "", "passenger.km")], 1, "National rail, per passenger.km."],
  ["commute-bus-pkm", "s3-commuting", "employee_commuting_bus", "km", "GB", [row(LAND, "Bus", "Average local bus", "", "passenger.km")], 1, "Average local bus, per passenger.km."],
  ["commute-car-avg-km", "s3-commuting", "employee_commuting", "km", "GB", [car(LAND, "Average car", "Unknown")], 1, "Average car, unknown fuel, per vehicle.km."],
  ["commute-car-bev-km", "s3-commuting", "employee_commuting_bev", "km", "GB", [car(LAND, "Average car", "Battery Electric Vehicle")], 1, "Average BEV, UK grid charging incl. T&D, per vehicle.km."],
  ["commute-motorbike-km", "s3-commuting", "employee_commuting_motorbike", "km", "GB", [row(LAND, "Motorbike", "Average", "", "km")], 1, "Motorbike, average, per vehicle.km."],
  ["commute-rail-pkm", "s3-commuting", "employee_commuting_rail", "km", "GB", [row(LAND, "Rail", "National rail", "", "passenger.km")], 1, "National rail, per passenger.km."],
  ["freight-air-tkm", "s3-upstream-transport", "upstream_transport_air_freight", "tonne.km", null, [row(FR, "Freight flights", "Long-haul, to/from UK", "With RF", "tonne.km")], 1, "Air freight, long-haul, with radiative forcing, per tonne.km."],
  ["freight-rail-tkm", "s3-upstream-transport", "upstream_transport_rail", "tonne.km", "GB", [row(FR, "Rail", "Freight train", "", "tonne.km")], 1, "Rail freight, per tonne.km."],
  ["freight-sea-container-tkm", "s3-upstream-transport", "upstream_transport_sea_container", "tonne.km", null, [row(FR, "Cargo ship", "Container ship", "", "tonne.km", "Average")], 1, "Container ship, average, per tonne.km."],
  ["hgv-40t-tkm", "s3-upstream-transport", "upstream_transport_hgv_40t", "tonne.km", "GB", [hgv("Articulated (>33t)")], 1, "HGV articulated >33t, average laden, per tonne.km."],
  ["hgv-7.5t-tkm", "s3-upstream-transport", "upstream_transport_hgv_7.5t", "tonne.km", "GB", [hgv("Rigid (>3.5 - 7.5 tonnes)")], 1, "HGV rigid 3.5-7.5t, average laden, per tonne.km."],
  ["hgv-artic-avg-tkm", "s3-upstream-transport", "upstream_transport_hgv_artic", "tonne.km", "GB", [hgv("Average non-refrigerated artics")], 1, "HGV articulated average, average laden, per tonne.km."],
  ["hgv-avg-tkm", "s3-upstream-transport", "upstream_transport", "tonne.km", "GB", [hgv("Average non-refrigerated HGVs")], 1, "HGV all types average, average laden, per tonne.km."],
  ["hgv-rigid-avg-tkm", "s3-upstream-transport", "upstream_transport_hgv_rigid", "tonne.km", "GB", [hgv("Average non-refrigerated rigids")], 1, "HGV rigid average, average laden, per tonne.km."],
  ["van-avg-km", "s3-upstream-transport", "upstream_transport_van_vehicle", "km", "GB", [row(DV, "Vans", "Average (up to 3.5 tonnes)", "Unknown", "km")], 1, "Van up to 3.5t, unknown fuel, per vehicle.km."],
  ["van-diesel-tkm", "s3-upstream-transport", "upstream_transport_van", "tonne.km", "GB", [row(FR, "Vans", "Average (up to 3.5 tonnes)", "Diesel", "tonne.km")], 1, "Van up to 3.5t, diesel, per tonne.km."],
  ["waste-efw-incineration", "s3-waste", "waste_disposal", "tonne", "GB", [waste("Refuse", "Commercial and industrial waste", "Combustion")], 1, "Commercial and industrial waste, combustion with energy recovery."],
  ["waste-incineration-kg", "s3-waste", "waste_disposal", "kg", "GB", [waste("Refuse", "Commercial and industrial waste", "Combustion")], 1000, "Commercial and industrial waste, combustion with energy recovery, per kg."],
  ["waste-inert-landfill", "s3-waste", "waste_disposal", "tonne", "GB", [waste("Construction", "Aggregates", "Landfill")], 1, "Inert construction waste (aggregates) to landfill."],
  ["waste-landfill-mixed-kg", "s3-waste", "waste_disposal", "kg", "GB", [waste("Refuse", "Commercial and industrial waste", "Landfill")], 1000, "Commercial and industrial waste to landfill, per kg."],
  ["waste-mixed-landfill", "s3-waste", "waste_disposal", "tonne", "GB", [waste("Refuse", "Commercial and industrial waste", "Landfill")], 1, "Commercial and industrial waste to landfill."],
  ["waste-mixed-recycling", "s3-waste", "waste_disposal", "tonne", "GB", [waste("Refuse", "Commercial and industrial waste", "Closed-loop")], 1, "Commercial and industrial waste, closed-loop recycling."],
  ["waste-recycled-mixed-kg", "s3-waste", "waste_disposal", "kg", "GB", [waste("Refuse", "Commercial and industrial waste", "Closed-loop")], 1000, "Commercial and industrial waste, closed-loop recycling, per kg."],
  ["waste-wood-landfill", "s3-waste", "waste_disposal", "tonne", "GB", [waste("Construction", "Wood", "Landfill")], 1, "Construction wood waste to landfill."],
];

const factors = SPEC.map(([suffix, categoryCode, activityType, inputUnit, geographyCountry, src, divisor, note]) => {
  const co2e = Number((src.reduce((sum, r) => sum + r.v, 0) / divisor).toPrecision(10));
  return {
    externalId: `defra-2026-${suffix}`,
    replacesExternalId: `defra-2025-${suffix}`,
    categoryCode,
    activityType,
    inputUnit,
    geographyCountry,
    co2e,
    usageNotes: `${note} DESNZ 2026 v1.2 flat file, row ${src.map((r) => r.id).join(" + ")}${divisor === 1 ? "" : `, per tonne / ${divisor}`}.`,
  };
});

writeFileSync(
  new URL("../prisma/data/defra-2026-factors.json", import.meta.url),
  JSON.stringify({ source: "DESNZ GHG conversion factors 2026, flat file v1.2 (revised July 2026)", factors }, null, 2) + "\n",
);
const q = (s) => (s == null ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const values = factors
  .map((f) => `  (${[f.externalId, f.categoryCode, f.activityType, f.geographyCountry, f.inputUnit].map(q).join(", ")}, ${f.co2e}, ${q(f.usageNotes)})`)
  .join(",\n");
const replaced = factors.map((f) => q(f.replacesExternalId)).join(", ");

const sql = `-- DESNZ/DEFRA GHG conversion factors 2026 (flat file v1.2, revised 10 July 2026).
-- Generated by scripts/build-defra-2026-factors.mjs; do not edit by hand.
--
-- A calculation run is pinned to one factor library, and DEFRA's guidance is
-- to use one year's factor set for a whole reporting period. So the 2026
-- factors carry no effective-date window: a period that crosses a year end
-- (e.g. Sep 2026 to Aug 2027) is fully covered by the library the run uses.
-- The DEFRA 2025.1 library is left untouched so existing runs reproduce.
--
-- Factors DESNZ does not publish (IPCC AR6 refrigerant GWPs used by this
-- methodology, EEIO spend factors, the Irish grid, the UK residual mix,
-- electric taxis, cycling) are carried forward from 2025.1 and flagged.
-- On an empty database (CI) the category lookups match nothing, so no factor
-- rows are inserted.

INSERT INTO "factor_libraries" ("id", "name", "version", "license", "source_url", "published_at", "created_at")
VALUES (
  gen_random_uuid()::text, 'DEFRA', '2026.1', 'Open Government Licence v3.0',
  'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026',
  DATE '2026-07-10', now()
)
ON CONFLICT ("name", "version") DO NOTHING;

WITH lib AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = 'DEFRA' AND "version" = '2026.1'
), src ("external_id", "category_code", "activity_type", "geography_country", "input_unit", "co2e", "usage_notes") AS (
  VALUES
${values}
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type",
  "geography_country", "input_unit", "co2e", "usage_notes"
)
SELECT gen_random_uuid()::text, lib."id", src."external_id", c."scope", c."id", src."activity_type",
       src."geography_country", src."input_unit", src."co2e", src."usage_notes"
FROM src
JOIN "emission_categories" c ON c."code" = src."category_code"
CROSS JOIN lib
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib."id" AND e."external_id" = src."external_id"
);

WITH lib26 AS (
  SELECT "id" FROM "factor_libraries" WHERE "name" = 'DEFRA' AND "version" = '2026.1'
), carried AS (
  SELECT DISTINCT ON (f."external_id") f.*
  FROM "emission_factors" f
  JOIN "factor_libraries" l ON l."id" = f."factor_library_id"
  WHERE l."name" = 'DEFRA' AND l."version" = '2025.1'
    AND f."external_id" NOT IN (${replaced})
  ORDER BY f."external_id", f."id"
)
INSERT INTO "emission_factors" (
  "id", "factor_library_id", "external_id", "scope", "emission_category_id", "activity_type",
  "geography_country", "geography_region", "input_unit", "co2", "ch4", "n2o", "co2e",
  "uncertainty_rating", "usage_notes", "biogenic_co2"
)
SELECT gen_random_uuid()::text, lib26."id", carried."external_id", carried."scope", carried."emission_category_id",
       carried."activity_type", carried."geography_country", carried."geography_region", carried."input_unit",
       carried."co2", carried."ch4", carried."n2o", carried."co2e", carried."uncertainty_rating",
       'Carried forward from DEFRA 2025.1 (no DESNZ 2026 equivalent). ' || coalesce(carried."usage_notes", ''),
       carried."biogenic_co2"
FROM carried
CROSS JOIN lib26
WHERE NOT EXISTS (
  SELECT 1 FROM "emission_factors" e WHERE e."factor_library_id" = lib26."id" AND e."external_id" = carried."external_id"
);
`;
const migrationDir = new URL("../prisma/migrations/20260922000011_defra_2026_factor_library/", import.meta.url);
mkdirSync(migrationDir, { recursive: true });
writeFileSync(new URL("migration.sql", migrationDir), sql);

console.log(`Wrote ${factors.length} factors and the migration.`);
