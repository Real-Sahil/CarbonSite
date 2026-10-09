export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { LINK_ISSUERS } from "@/lib/evidence/submission-link";
import { acceptTransferNote } from "@/lib/waste/accept";
import { loadTriage } from "@/lib/waste/triage-load";

const body = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(50) }).strict();

// POST: a reviewer approves several transfer notes in one click. Each is triaged again on the server, so only
// notes that are still ready become records; the rest come back with the reasons. One record per document.
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const { ids } = body.parse(await req.json());
    const docs = await prisma.wasteDocument.findMany({ where: { id: { in: ids }, organizationId: orgId, kind: "transfer_note", wasteRecordId: null } });
    const triage = await loadTriage(orgId, docs);
    const recorded: string[] = [];
    const skipped: { id: string; reasons: string[] }[] = ids.filter((i) => !docs.some((d) => d.id === i)).map((id) => ({ id, reasons: ["Not found or already recorded"] }));
    for (const d of docs) {
      const t = triage.get(d.id);
      if (!t || t.state !== "ready" || !t.body) { skipped.push({ id: d.id, reasons: t?.reasons ?? ["Not read yet"] }); continue; }
      const refs = await orgRefsError(orgId, { facilityId: t.body.facilityId, reportingPeriodId: t.body.reportingPeriodId, projectId: t.body.projectId });
      if (refs) { skipped.push({ id: d.id, reasons: ["A facility, period or project no longer exists"] }); continue; }
      // The reference is checked again right before the insert, so a record made a moment ago by someone else is seen.
      if (t.body.transferNoteReference) {
        const dup = await prisma.wasteRecord.findFirst({ where: { organizationId: orgId, transferNoteReference: { equals: t.body.transferNoteReference, mode: "insensitive" } }, select: { id: true } });
        if (dup) { skipped.push({ id: d.id, reasons: ["A waste record with this reference already exists"] }); continue; }
      }
      const rec = await acceptTransferNote(orgId, session.user.id, d.id, t.body, t.suggestion, "bulk");
      if (rec) recorded.push(d.id); else skipped.push({ id: d.id, reasons: ["Already recorded"] });
    }
    return NextResponse.json({ recorded: recorded.length, skipped });
  } catch (err) {
    return handleRouteError(err);
  }
}
