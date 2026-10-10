import { prisma } from "@/lib/db";

// Audit rows keep their action, resource, timestamp and hash for ever; after the retention period
// the personal fields go: who did it, from where, and the free-form metadata that can carry names
// and emails. The stored hash is kept, so the chain still links (ChainVerifier counts the row as
// redacted); only that row's own contents can no longer be rechecked. Rows are never deleted.

/** Decided in docs/legal/POLICY_DRAFTS.md section 4: six years, the contract limitation period. */
export const AUDIT_RETENTION_YEARS = 6;
const BATCH = 1_000;
const MAX_BATCHES = 40;

export function auditRetentionCutoff(now: Date = new Date(), years = AUDIT_RETENTION_YEARS): Date {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d;
}

/** Anonymises one capped run of expired rows; returns how many. Safe to repeat: redacted rows are skipped. */
export async function anonymiseExpiredAuditRows(now: Date = new Date()): Promise<number> {
  const cutoff = auditRetentionCutoff(now);
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const done = await prisma.$executeRaw`
      UPDATE audit_logs SET actor_user_id = NULL, ip_address = NULL, user_agent = NULL,
        metadata = '{"redacted":true}'::jsonb, redacted_at = ${now}
      WHERE id IN (
        SELECT id FROM audit_logs WHERE redacted_at IS NULL AND created_at < ${cutoff} ORDER BY created_at LIMIT ${BATCH}
      )`;
    total += done;
    if (done < BATCH) break;
  }
  return total;
}
