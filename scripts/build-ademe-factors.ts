// Builds the migration that loads ADEME Base Carbone factors.
// Download the full CSV from https://data.ademe.fr/datasets/base-carboner
// (Télécharger > fichier complet), then run:
//   pnpm tsx scripts/build-ademe-factors.ts <file.csv> <YYYYMMDDhhmmss_name> [--after <earlier ADEME migration dir>...]
// With --after, factors an earlier ADEME migration already inserts are left
// out, so a follow-up migration carries only the additions.
// It prints how many factors map to each category and why the rest are left
// out (the same summary heads the migration).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildAdemeFactors, buildAdemeMigrationSql } from "../lib/factors/ademe";

const [, , file, name, ...rest] = process.argv;
if (!file || !name || !/^\d{14}_[a-z0-9_]+$/.test(name)) {
  throw new Error("Usage: pnpm tsx scripts/build-ademe-factors.ts <file.csv> <YYYYMMDDhhmmss_name> [--after <migration dir>...]");
}
const after = rest[0] === "--after" ? rest.slice(1) : [];
const earlier = new Set<string>();
for (const d of after) {
  const sql = readFileSync(join(d, "migration.sql"), "utf8");
  for (const m of sql.matchAll(/^\s+\('(ademe-[^']+)'/gm)) earlier.add(m[1]);
}
const full = buildAdemeFactors(readFileSync(file, "utf8"));
const build = { ...full, factors: full.factors.filter((f) => !earlier.has(f.externalId)) };
const dir = join("prisma", "migrations", name);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "migration.sql"), buildAdemeMigrationSql(build, basename(file), earlier.size));
const byCategory = new Map<string, number>();
for (const f of build.factors) byCategory.set(f.categoryCode, (byCategory.get(f.categoryCode) ?? 0) + 1);
console.log(`${build.factors.length} factors (export ${build.version}, spend year ${build.spendYear}${earlier.size ? `, ${earlier.size} already loaded` : ""}) -> ${join(dir, "migration.sql")}`);
for (const [c, n] of [...byCategory].sort()) console.log(`  ${c}: ${n}`);
