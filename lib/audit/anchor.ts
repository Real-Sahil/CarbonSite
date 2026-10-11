import { prisma } from "@/lib/db";
import { CHAIN_VERSION } from "@/lib/audit/chain";
import { getObject, isExternalStorageDriver, keys, putObject } from "@/lib/storage";

// The audit chain only proves its own links. Someone who can write the database can still
// delete the newest rows and the shorter chain checks out. An anchor copies the head (sequence
// and hash) into object storage once a day; a check then fails if the anchored row is gone
// (truncated) or carries another hash (rewritten). Storage is a second store, not a third party:
// anyone holding the service role key can rewrite the anchor too, so it raises the bar rather
// than closing the gap.

export interface AuditAnchor {
  organizationId: string;
  headSeq: string;
  headHash: string;
  chainVersion: number;
  anchoredAt: string;
}

export type AnchorCheck =
  /** No readable anchor yet, or the anchor file is not one this code wrote. */
  | { status: "none"; external: boolean; reason: string }
  | { status: "matches"; external: boolean; anchor: AuditAnchor }
  /** The anchored row no longer exists: the chain was cut short after the anchor. */
  | { status: "truncated"; external: boolean; anchor: AuditAnchor }
  /** The anchored row now carries a different hash: its contents or link were changed. */
  | { status: "rewritten"; external: boolean; anchor: AuditAnchor };

const SEQ_RE = /^\d+$/;
const PAGE = 200;

/**
 * Writes the organisation's current chain head to storage. Returns null when the chain is empty
 * or its head is a legacy row with no stored hash (nothing to anchor).
 */
export async function writeAuditAnchor(organizationId: string, now: Date = new Date()): Promise<AuditAnchor | null> {
  const head = await prisma.auditLog.findFirst({
    where: { organizationId },
    orderBy: { chainSeq: "desc" },
    select: { chainSeq: true, hash: true },
  });
  if (!head?.hash) return null;

  const anchor: AuditAnchor = {
    organizationId,
    headSeq: head.chainSeq.toString(),
    headHash: head.hash,
    chainVersion: CHAIN_VERSION,
    anchoredAt: now.toISOString(),
  };
  const body = Buffer.from(JSON.stringify(anchor, null, 2));
  await putObject(keys.auditAnchor(organizationId, anchor.headSeq), body, "application/json");
  await putObject(keys.auditAnchorLatest(organizationId), body, "application/json");
  return anchor;
}

/**
 * Writes an anchor for every organisation with audit rows. Skipped on the db and local drivers,
 * where the anchor would sit in the same database as the rows it is meant to check.
 */
export async function anchorAllAuditChains(now: Date = new Date()): Promise<{ anchored: number; failed: number; skipped?: string }> {
  if (!isExternalStorageDriver()) {
    return {
      anchored: 0,
      failed: 0,
      skipped: "storage is not external (STORAGE_DRIVER db or local): an anchor there would sit beside the audit rows",
    };
  }

  let anchored = 0;
  let failed = 0;
  let after: string | undefined;
  for (;;) {
    const orgs = await prisma.organization.findMany({
      where: after ? { id: { gt: after } } : undefined,
      orderBy: { id: "asc" },
      take: PAGE,
      select: { id: true },
    });
    if (!orgs.length) break;
    for (const org of orgs) {
      try {
        if (await writeAuditAnchor(org.id, now)) anchored++;
      } catch (err) {
        failed++;
        console.error(`[audit-anchor] ${org.id} failed:`, err);
      }
    }
    after = orgs[orgs.length - 1].id;
    if (orgs.length < PAGE) break;
  }
  return { anchored, failed };
}

/** Compares the latest stored anchor with the chain as it is now. */
export async function checkAuditAnchor(organizationId: string): Promise<AnchorCheck> {
  const external = isExternalStorageDriver();

  let anchor: AuditAnchor;
  try {
    const parsed = JSON.parse((await getObject(keys.auditAnchorLatest(organizationId))).toString("utf8")) as Partial<AuditAnchor>;
    if (
      parsed.organizationId !== organizationId ||
      typeof parsed.headSeq !== "string" ||
      !SEQ_RE.test(parsed.headSeq) ||
      typeof parsed.headHash !== "string"
    ) {
      return { status: "none", external, reason: "The stored anchor is not one this check can read." };
    }
    anchor = parsed as AuditAnchor;
  } catch {
    return { status: "none", external, reason: "No anchor has been written yet, or it could not be read from storage." };
  }

  const row = await prisma.auditLog.findFirst({
    where: { organizationId, chainSeq: BigInt(anchor.headSeq) },
    select: { hash: true },
  });
  if (!row) return { status: "truncated", external, anchor };
  if (row.hash !== anchor.headHash) return { status: "rewritten", external, anchor };
  return { status: "matches", external, anchor };
}
