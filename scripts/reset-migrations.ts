import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => {
      const full = path.join(migrationsDir, d);
      return (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, "migration.sql"))
      );
    })
    .sort();

  console.log(`Found ${dirs.length} migrations to mark as applied`);

  await prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations`);

  for (const dir of dirs) {
    const sqlPath = path.join(migrationsDir, dir, "migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    await prisma.$executeRawUnsafe(
      `INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW(), 1)`,
      checksum,
      dir
    );
  }

  console.log(`Marked ${dirs.length} migrations as applied`);
}

main()
  .catch((e) => {
    console.error("Migration reset failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
