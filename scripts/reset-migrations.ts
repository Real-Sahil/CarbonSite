import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM _prisma_migrations`);
    console.log("Cleared _prisma_migrations table");
  } catch (e: any) {
    console.log("Could not clear _prisma_migrations:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
