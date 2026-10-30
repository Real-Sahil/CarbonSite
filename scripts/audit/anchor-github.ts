// Run by .github/workflows/audit-anchor.yml with DATABASE_URL pointing at production (reads only).
// Usage: tsx scripts/audit/anchor-github.ts <path to latest.json on the audit-anchors checkout>
// Checks every earlier head against the database, then writes the current heads to that file.
// Exits 1 without writing when an earlier head no longer matches, so a cut or rewritten chain is
// never anchored over.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { buildAnchorFile, findAnchorProblems, parseAnchorFile, type HeadAnchor } from "@/lib/audit/github-anchor";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: anchor-github.ts <latest.json>");
  const previous = parseAnchorFile(existsSync(file) ? readFileSync(file, "utf8") : null);

  const problems = await findAnchorProblems(previous, async (organizationId, seq) => {
    const row = await prisma.auditLog.findFirst({
      where: { organizationId, chainSeq: BigInt(seq) },
      select: { hash: true },
    });
    return row ? row.hash : undefined;
  });
  for (const p of problems) {
    const detail = p.kind === "truncated" ? "anchored row is gone" : "anchored row carries another hash";
    console.error(`::error::audit chain ${p.kind} for ${p.organizationId} at chainSeq ${p.headSeq}: ${detail}`);
  }
  if (problems.length) process.exit(1);

  const current: Record<string, HeadAnchor> = {};
  const orgs = await prisma.auditLog.groupBy({ by: ["organizationId"] });
  for (const { organizationId } of orgs) {
    const head = await prisma.auditLog.findFirst({
      where: { organizationId, hash: { not: null } },
      orderBy: { chainSeq: "desc" },
      select: { chainSeq: true, hash: true },
    });
    if (head?.hash) current[organizationId] = { headSeq: head.chainSeq.toString(), headHash: head.hash };
  }

  writeFileSync(file, JSON.stringify(buildAnchorFile(previous, current, new Date()), null, 2) + "\n");
  console.log(`anchored ${Object.keys(current).length} organisations (${previous ? Object.keys(previous.heads).length : 0} checked first)`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("::error::audit anchor could not run:", err);
  process.exit(1);
});
