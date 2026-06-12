import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { boss: PgBoss; bossStarted: boolean };

export const boss =
  globalForBoss.boss ??
  new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") globalForBoss.boss = boss;

export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.bossStarted) {
    await boss.start();
    globalForBoss.bossStarted = true;
  }
  return boss;
}

export async function ensureBossStarted(): Promise<void> {
  await getBoss();
}
