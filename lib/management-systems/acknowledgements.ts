import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { REGISTERS, type RegisterKey } from "./registers/config";
import { delegate } from "./registers/server";

// Read-and-acknowledge for policies and controlled documents: a member
// confirms they have read the current approved version. A new version needs
// confirming again, so the count always refers to what is in force.

type Row = Record<string, unknown> & { id: string };

export async function loadAcknowledgements(orgId: string, key: RegisterKey, rows: Row[], userId: string) {
  if (!rows.length) return {};
  const [acks, users] = await Promise.all([
    prisma.msAcknowledgement.findMany({
      where: { organizationId: orgId, registerKey: key, rowId: { in: rows.map((r) => r.id) } },
      select: { rowId: true, version: true, userId: true },
    }),
    prisma.organizationMembership.findMany({
      where: { organizationId: orgId, role: { notIn: ["field_worker", "supplier"] } },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const name = new Map(users.map((u) => [u.user.id, u.user.name || u.user.email]));
  const out: Record<string, { version: number; count: number; mine: boolean; names: string[] }> = {};
  for (const r of rows) {
    const version = Number(r.version ?? 1);
    const current = acks.filter((a) => a.rowId === r.id && a.version === version && name.has(a.userId));
    out[r.id] = { version, count: current.length, mine: current.some((a) => a.userId === userId), names: current.map((a) => name.get(a.userId)!).sort() };
  }
  return out;
}

export class AcknowledgeError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
  }
}

/** Records that `userId` has read the row's current approved version. Idempotent. */
export async function acknowledge(orgId: string, key: RegisterKey, rowId: string, userId: string) {
  if (!REGISTERS[key].acknowledgeable) throw new AcknowledgeError("This register has nothing to acknowledge.", 404, "NOT_FOUND");
  const row = await delegate(key).findFirst({ where: { id: rowId, organizationId: orgId } });
  if (!row) throw new AcknowledgeError(`That ${REGISTERS[key].singular} was not found.`, 404, "NOT_FOUND");
  if (row.status !== "approved") throw new AcknowledgeError("Only an approved version can be acknowledged.", 409, "NOT_APPROVED");
  const version = Number(row.version ?? 1);
  const existing = await prisma.msAcknowledgement.findUnique({
    where: { organizationId_registerKey_rowId_version_userId: { organizationId: orgId, registerKey: key, rowId, version, userId } },
  });
  if (existing) return existing;
  const ack = await prisma.msAcknowledgement.create({ data: { organizationId: orgId, registerKey: key, rowId, version, userId } });
  await writeAuditLog({
    organizationId: orgId,
    actorUserId: userId,
    action: "management_system.document_acknowledged",
    resourceType: REGISTERS[key].evidenceKind,
    resourceId: rowId,
    metadata: { register: key, version },
  });
  return ack;
}
