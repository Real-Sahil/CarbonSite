// DSAR export worker (UK GDPR Art. 15) — builds a zip archive of every
// PII-registry-listed row belonging to one data subject and uploads it to
// storage. Invoked via lib/jobs/dispatch.ts (inline) or workers/index.ts
// (pg-boss "dsar-export" queue), mirroring the other worker entry points
// under workers/ and lib/*/worker.ts.

import { ZipArchive } from "archiver";
import { PassThrough } from "stream";
import { prisma } from "@/lib/db";
import { putObject, keys } from "@/lib/storage";
import { writeAuditLog } from "@/lib/db/audit";
import { PII_REGISTRY, delegateNameFor, type PiiSubject } from "@/lib/compliance/pii-registry";

type Delegate = { findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]> };

function getDelegate(modelName: string): Delegate {
  return (prisma as unknown as Record<string, Delegate>)[delegateNameFor(modelName)];
}

function jsonReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

async function buildZipBuffer(files: { name: string; content: string }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    const out = new PassThrough();
    out.on("data", (chunk: Buffer) => chunks.push(chunk));
    out.on("end", () => resolve(Buffer.concat(chunks)));
    out.on("error", reject);
    archive.on("error", reject);
    archive.pipe(out);
    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }
    void archive.finalize();
  });
}

export async function processDsarExport(dsarRequestId: string): Promise<void> {
  const request = await prisma.dsarRequest.findUnique({ where: { id: dsarRequestId } });
  if (!request) throw new Error(`DSAR request not found: ${dsarRequestId}`);
  if (request.type !== "export") {
    throw new Error(`DSAR request ${dsarRequestId} is type "${request.type}", not "export"`);
  }

  await prisma.dsarRequest.update({
    where: { id: dsarRequestId },
    data: { status: "processing" },
  });

  try {
    const user = await prisma.user.findUnique({
      where: { id: request.userId },
      select: { id: true, email: true },
    });
    if (!user) throw new Error(`Subject user not found: ${request.userId}`);
    const subject: PiiSubject = { userId: user.id, email: user.email };

    // Sequential, not Promise.all — the pooled Prisma client runs with
    // connection_limit=2 (lib/db/index.ts); parallel bursts here would just
    // queue up behind that pool rather than actually go faster.
    const files: { name: string; content: string }[] = [];
    for (const entry of PII_REGISTRY) {
      const delegate = getDelegate(entry.model);
      const rows = await delegate.findMany({ where: entry.where(subject) });
      files.push({
        name: `${entry.model}.json`,
        content: JSON.stringify(rows, jsonReplacer, 2),
      });
    }
    files.push({
      name: "README.txt",
      content:
        `Data export for ${user.email}, generated ${new Date().toISOString()}.\n\n` +
        `Each file corresponds to one data category. See the MetricOra privacy ` +
        `policy for what each category means. Some records (e.g. activity records, ` +
        `evidence, field submissions) are retained by the organisation for its own ` +
        `compliance record-keeping even after an erasure request — see the erasure ` +
        `confirmation you received separately for what that request covered.\n`,
    });

    const zipBuffer = await buildZipBuffer(files);
    const storageKey = keys.dsarExport(user.id, dsarRequestId);
    await putObject(storageKey, zipBuffer, "application/zip");

    await prisma.dsarRequest.update({
      where: { id: dsarRequestId },
      data: { status: "completed", completedAt: new Date(), resultStorageKey: storageKey },
    });

    // AuditLog.organizationId is a required FK — there's no "account-level"
    // org to attach a DSAR event to, so record it into every org this
    // subject actually belongs to (their own memberships, not every org on
    // the platform). A user with zero memberships gets no audit-log entry;
    // the DsarRequest row itself remains the record of what happened.
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: user.id },
      select: { organizationId: true },
    });
    for (const { organizationId } of memberships) {
      await writeAuditLog({
        organizationId,
        actorUserId: request.requestedByUserId,
        action: "dsar.export_completed",
        resourceType: "dsar_request",
        resourceId: dsarRequestId,
        metadata: { subjectUserId: user.id },
      });
    }
  } catch (err) {
    await prisma.dsarRequest.update({
      where: { id: dsarRequestId },
      data: { status: "failed" },
    });
    throw err;
  }
}
