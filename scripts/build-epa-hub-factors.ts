// Builds the migration that completes the EPA 2025.1 library from the EPA GHG
// Emission Factors Hub 2025 workbook and eGRID2023 (revision 2) data file:
//   pnpm tsx scripts/build-epa-hub-factors.ts <hub.xlsx> <egrid2023_data_rev2.xlsx> <YYYYMMDDhhmmss_name>
// Files: data/sources/ghg-emission-factors-hub-2025.xlsx and
// data/sources/egrid2023_data_rev2.xlsx (links in docs/THIRD_PARTY_SOURCES.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as XLSX from "xlsx";
import { buildEpaHubFactors, buildEpaHubMigrationSql } from "../lib/factors/epa-hub";

const [, , hubFile, egridFile, name] = process.argv;
if (!hubFile || !egridFile || !name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
  throw new Error("Usage: pnpm tsx scripts/build-epa-hub-factors.ts <hub.xlsx> <egrid.xlsx> <YYYYMMDDhhmmss_name>");
}
const rowsOf = (wb: XLSX.WorkBook, sheet: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: "" });
const hub = XLSX.readFile(hubFile);
const egrid = XLSX.readFile(egridFile, { sheets: ["SRL23", "US23"] });
const factors = buildEpaHubFactors({
  hub: rowsOf(hub, hub.SheetNames[0]),
  egridSubregions: rowsOf(egrid, "SRL23"),
  egridUs: rowsOf(egrid, "US23"),
});
const dir = join("prisma", "migrations", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), buildEpaHubMigrationSql(factors, [basename(hubFile), basename(egridFile)]));
const byCategory = new Map<string, number>();
for (const f of factors) byCategory.set(f.categoryCode, (byCategory.get(f.categoryCode) ?? 0) + 1);
console.log(`${factors.length} factors -> ${join(dir, "migration.sql")}`);
for (const [c, n] of [...byCategory].sort()) console.log(`  ${c}: ${n}`);
