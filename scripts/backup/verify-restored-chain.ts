// Part of the weekly restore drill: runs the audit-chain check on the restored copy, for every
// organisation, so a backup whose chain no longer verifies fails the drill instead of being found
// during a real restore. Reads only; DATABASE_URL must point at the restored database.

import { prisma } from "@/lib/db";
import { verifyAuditChain } from "@/lib/db/audit";

async function main() {
  const orgs = await prisma.auditLog.groupBy({ by: ["organizationId"] });
  let failed = 0;
  let rows = 0;
  for (const { organizationId } of orgs) {
    const r = await verifyAuditChain(organizationId);
    rows += r.rows;
    if (r.status === "broken") {
      failed++;
      console.error(`::error::audit chain broken in restored backup for ${organizationId} at chainSeq ${r.firstBreak?.chainSeq} (${r.firstBreak?.reason})`);
    }
  }
  console.log(`audit chains: ${orgs.length} organisations, ${rows} rows, ${failed} broken`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("::error::audit chain check could not run:", err);
  process.exit(1);
});
