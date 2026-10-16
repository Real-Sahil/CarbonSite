// Lists the migrations Prisma refuses to deploy past: rows in _prisma_migrations
// that started and never finished (P3009). One name per line. Read-only.
// migrate.yml uses this to decide which recovery `migrate resolve` calls apply.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  // A fresh database has no migration table yet; `migrate deploy` creates it.
  const [{ present }] = await prisma.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
  const failed = present
    ? await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`
    : [];
  for (const row of failed) console.log(row.migration_name);
} finally {
  await prisma.$disconnect();
}
