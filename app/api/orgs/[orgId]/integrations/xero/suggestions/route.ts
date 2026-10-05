import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/limits";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { stageConnectorRecords } from "@/lib/connectors/ingest";
import { ledgerRecords, loadLedgerLines } from "@/lib/ledger/xero-lines";
import { STAGEABLE_CATEGORIES } from "@/lib/ledger/suggest";
import { handleRouteError } from "@/lib/validation/api";

// Ledger lines already synced from Xero, each with a suggested category, and the step that
// stages the ones a person confirmed. Staging creates an import batch that waits in Imports for
// review and commit, exactly like a manual upload.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { reportingCurrency: true } });
    const lines = await loadLedgerLines(orgId);
    return NextResponse.json({ currency: org?.reportingCurrency ?? "GBP", lines });
  } catch (err) {
    return handleRouteError(err);
  }
}

const stageBody = z.object({
  reportingPeriodId: z.string().min(1),
  lines: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryCode: z.enum(STAGEABLE_CATEGORIES),
        industryCode: z.string().regex(/^\d{2}(\.\d{1,2})?$/).nullish(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const gate = await requireFeature(orgId, "accountingIntegrations");
    if (gate) return gate;

    const body = stageBody.parse(await req.json());
    const confirmed = new Map(body.lines.map((l) => [l.id, l]));

    // Lines are looked up inside the organisation; an id from elsewhere simply is not found.
    const all = await loadLedgerLines(orgId);
    const picked = all.filter((l) => confirmed.has(l.id)).map((l) => ({ ...l, confirmed: confirmed.get(l.id)! }));
    if (picked.length === 0) {
      return NextResponse.json({ code: "NO_LINES", message: "None of those lines are waiting to be staged." }, { status: 422 });
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { reportingCurrency: true } });
    const res = await stageConnectorRecords({
      orgId,
      reportingPeriodId: body.reportingPeriodId,
      source: "xero_ledger",
      externalBatchId: `ledger-${Date.now()}`,
      records: ledgerRecords(picked, org?.reportingCurrency ?? "GBP"),
    });

    if (res.status === 202 || res.status === 200) {
      // The confirmed category is kept on the line, so the next sync of that supplier starts from it.
      const byCategory = new Map<string, string[]>();
      for (const p of picked) byCategory.set(p.confirmed.categoryCode, [...(byCategory.get(p.confirmed.categoryCode) ?? []), p.id]);
      for (const [category, ids] of byCategory) {
        await prisma.xeroSyncLog.updateMany({
          where: { organizationId: orgId, id: { in: ids } },
          data: { status: "staged", category },
        });
      }
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "ledger.lines_staged",
        resourceType: "xero_sync_log",
        resourceId: picked[0].id,
        metadata: { lines: picked.length, reportingPeriodId: body.reportingPeriodId },
      });
    }
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
