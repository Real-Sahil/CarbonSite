import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { boss: PgBoss };

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForBoss.boss = boss;
