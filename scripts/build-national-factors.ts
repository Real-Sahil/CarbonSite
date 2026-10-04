// Builds the migration for one national factor library from its official workbook:
//   pnpm tsx scripts/build-national-factors.ts <nga|eccc|uba|seai> <workbook.xlsx> <YYYYMMDDhhmmss_name>
// Workbooks are in data/sources/ (links in docs/THIRD_PARTY_SOURCES.md).
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as XLSX from "xlsx";
import { buildEcccFactors } from "../lib/factors/eccc";
import { buildNgaFactors } from "../lib/factors/nga";
import { NATIONAL_SOURCES } from "../lib/factors/national-libraries";
import { buildNationalMigrationSql } from "../lib/factors/national-load";
import { buildSeaiFactors } from "../lib/factors/seai";
import { buildUbaFactors } from "../lib/factors/uba";

const [, , which, file, name] = process.argv;
if (!which || !(which in NATIONAL_SOURCES) || !file || !name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
  throw new Error("Usage: pnpm tsx scripts/build-national-factors.ts <nga|eccc|uba|seai> <workbook.xlsx> <YYYYMMDDhhmmss_name>");
}
const key = which as keyof typeof NATIONAL_SOURCES;
const wb = XLSX.readFile(file);
const sheets: Record<string, unknown[][]> = {};
for (const n of wb.SheetNames) sheets[n] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, defval: "" });
const factors = { nga: buildNgaFactors, eccc: buildEcccFactors, uba: buildUbaFactors, seai: buildSeaiFactors }[key](sheets);
const src = NATIONAL_SOURCES[key];
const dir = join("prisma", "migrations", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), buildNationalMigrationSql(src.library, factors, [basename(file)], src.comments));
const byCategory = new Map<string, number>();
for (const f of factors) byCategory.set(f.categoryCode, (byCategory.get(f.categoryCode) ?? 0) + 1);
console.log(`${factors.length} factors -> ${join(dir, "migration.sql")}`);
for (const [c, n] of [...byCategory].sort()) console.log(`  ${c}: ${n}`);
