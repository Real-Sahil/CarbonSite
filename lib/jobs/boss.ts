import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { boss: PgBoss };
const globalForBossStart = globalThis as unknown as {
  bossStartPromise?: Promise<void>;
};

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForBoss.boss = boss;

export async function ensureBossStarted() {
  globalForBossStart.bossStartPromise ??= boss.start().then(() => undefined);
  await globalForBossStart.bossStartPromise;
}
