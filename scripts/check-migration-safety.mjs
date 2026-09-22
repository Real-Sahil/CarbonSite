// Guards the two ways a migration has broken production:
//
// 1. Destructive changes shipped with the code that stops using them.
//    migrate.yml applies migrations as soon as code reaches main, while the
//    previous deploy is still serving traffic. Dropping, renaming or retyping
//    something that live code reads breaks it until the new deploy finishes.
//    Such a change must ship in a later release than the code change, and the
//    migration must say so with a `-- contract-step:` line explaining why it is
//    safe. Migrations up to BASELINE are grandfathered.
//
// 2. schema.prisma drifting further from the migrations. Pass the output of
//    `prisma migrate diff --script` on stdin with --drift: the statement count
//    must not exceed prisma/drift-baseline.txt. Lower the baseline as drift is fixed.
import { readdirSync, readFileSync } from "node:fs";

const BASELINE = "20260922000011_defra_2026_factor_library";
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bDROP\s+TYPE\b/i,
  /\bRENAME\s+(COLUMN|TO)\b/i,
  /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i,
  /\bSET\s+NOT\s+NULL\b/i,
];

if (process.argv.includes("--drift")) {
  const input = readFileSync(0, "utf8");
  const count = input.split("\n").filter((l) => /^(ALTER|CREATE|DROP)\b/.test(l)).length;
  const baseline = Number(readFileSync(new URL("../prisma/drift-baseline.txt", import.meta.url), "utf8").trim());
  console.log(`schema drift: ${count} statements (baseline ${baseline})`);
  if (count > baseline) {
    console.error("::error::schema.prisma drifted further from the migrations. Add a migration for the change.");
    process.exit(1);
  }
  process.exit(0);
}

const dir = new URL("../prisma/migrations/", import.meta.url);
const failures = [];
for (const name of readdirSync(dir).filter((n) => !n.includes(".") && n > BASELINE).sort()) {
  const sql = readFileSync(new URL(`${name}/migration.sql`, dir), "utf8");
  const code = sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  const hit = DESTRUCTIVE.find((re) => re.test(code));
  if (hit && !/^--\s*contract-step:/m.test(sql)) failures.push(`${name}: matches ${hit}`);
}
if (failures.length) {
  for (const f of failures) console.error(`::error::${f}`);
  console.error(
    "Destructive migration without a `-- contract-step:` line. Ship the code change first, then add the drop/rename in a later release with that line explaining why no deployed code still depends on it.",
  );
  process.exit(1);
}
console.log("migration safety: ok");
