import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { resolveInventoryAuditorToken, touchInventoryAuditorAccess } from "@/lib/assurance/auditor-link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory verification", robots: { index: false, follow: false } };

const day = (d: Date) => d.toISOString().slice(0, 10);

/** Read-only page for an independent verifier, opened from a time-limited link. */
export default async function InventoryAuditPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await resolveInventoryAuditorToken(token);
  if (!access) {
    return (
      <main className="min-h-[100dvh] bg-slate-50 px-4 py-16">
        <p className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-700">
          This link has expired or been withdrawn. Ask the organisation for a new one.
        </p>
      </main>
    );
  }
  // One audit entry per hour of use is enough to show who looked and when.
  if (!access.lastUsedAt || Date.now() - access.lastUsedAt.getTime() > 3_600_000) {
    await writeAuditLog({ organizationId: access.organizationId, action: "assurance.auditor_link_opened", resourceType: "InventoryAuditorAccess", resourceId: access.id, metadata: { auditor: access.name, company: access.company } });
  }
  await touchInventoryAuditorAccess(access.id);

  const org = await prisma.organization.findUnique({ where: { id: access.organizationId }, select: { name: true } });
  const { snapshot } = access;

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{org?.name}</p>
          <h1 className="text-2xl font-bold text-slate-950">Greenhouse gas inventory for verification</h1>
          <p className="text-sm text-slate-600">
            {snapshot.reportingPeriod.label} ({day(snapshot.reportingPeriod.startDate)} to {day(snapshot.reportingPeriod.endDate)}), published snapshot version {snapshot.version}, published {day(snapshot.publishedAt)}.
            Shared with {access.name}{access.company ? `, ${access.company}` : ""}, read only, until {day(access.expiresAt)}. Every visit and download is recorded in the organisation&apos;s audit log.
          </p>
          <a href={`/api/public/inventory-audit/${token}/pack`} className="self-start rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black">Download the assurance pack (ZIP)</a>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
          <h2 className="mb-2 text-base font-semibold text-slate-950">What the pack holds</h2>
          <p>
            Every stored calculation in the snapshot&apos;s run with its record, factor, formula, selection reason and warnings (<code>calculations.csv</code>); the factors used (<code>factors.csv</code>);
            the evidence files with their SHA-256 (<code>evidence-index.csv</code>); the audit trail with its hash chain (<code>audit-log.csv</code>); and a manifest of checksums.
            Published figures are immutable, and nothing in the pack changes them.
          </p>
          <h2 className="mb-2 mt-4 text-base font-semibold text-slate-950">How to test it</h2>
          <p>
            Each calculation carries a <code>recompute_status</code>: the formula&apos;s own arithmetic repeated and compared with the stored total. Start with rows marked <em>differs</em> or <em>not_checkable</em>.
            That check does not look the factor up again, so compare factor values with <code>factors.csv</code> and the publisher&apos;s file, and sample records against their evidence.
          </p>
        </section>
      </div>
    </main>
  );
}
