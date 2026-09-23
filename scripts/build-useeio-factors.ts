// Builds the migration that loads EPA USEEIO v1.3 NAICS-6 spend factors.
// Download "SupplyChainGHGEmissionFactors_v1.3.0_NAICS_CO2e_USD2022.csv" from
// https://catalog.data.gov/dataset/supply-chain-greenhouse-gas-emission-factors-v1-3-by-naics-6
// then run:
//   pnpm tsx scripts/build-useeio-factors.ts <file.csv> <migration_name>
// e.g. <migration_name> = 20261001000001_epa_useeio_v13
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildUseeioMigrationSql, parseUseeioCsv } from "../lib/factors/useeio";

const [, , file, name] = process.argv;
if (!file || !name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
  throw new Error("Usage: pnpm tsx scripts/build-useeio-factors.ts <file.csv> <YYYYMMDDhhmmss_name>");
}
const factors = parseUseeioCsv(readFileSync(file, "utf8"));
const dir = join("prisma", "migrations", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), buildUseeioMigrationSql(factors, basename(file)));
console.log(`${factors.length} factors -> ${join(dir, "migration.sql")}`);
