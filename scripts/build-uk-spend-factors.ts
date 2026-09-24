// Builds the migration that loads the Defra UK spend multipliers by SIC.
// The extract in data/sources was taken from the published .ods (sheet
// GHG_SIC_multipliers); to refresh it, download the new workbook from
// https://www.gov.uk/government/statistics/uks-carbon-footprint, write the
// same `code|title|years...` lines, then run:
//   pnpm tsx scripts/build-uk-spend-factors.ts <extract.txt> <YYYYMMDDhhmmss_name>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildUkSpendMigrationSql, parseUkSpendExtract } from "../lib/factors/uk-spend";

const [, , file, name] = process.argv;
if (!file || !name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
  throw new Error("Usage: pnpm tsx scripts/build-uk-spend-factors.ts <extract.txt> <YYYYMMDDhhmmss_name>");
}
const data = parseUkSpendExtract(readFileSync(file, "utf8"));
const dir = join("prisma", "migrations", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), buildUkSpendMigrationSql(data, basename(file)));
console.log(`${data.groups.length} SIC groups, years ${data.years.join(", ")} -> ${join(dir, "migration.sql")}`);
