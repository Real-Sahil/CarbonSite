export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { DocumentReadError } from "@/lib/imports/parsers/pdf";
import { getObject } from "@/lib/storage";
import { readBill } from "@/lib/evidence/read-bill";
import { BILL_EXTRACTOR_VERSION } from "@/lib/evidence/bill-extractor";

type Params = { params: Promise<{ orgId: string; itemId: string }> };

async function loadItem(orgId: string, itemId: string) {
  return prisma.billInboxItem.findFirst({
    where: { id: itemId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      evidenceFile: {
        select: {
          id: true,
          mimeType: true,
          storageKey: true,
          recordEvidence: { select: { id: true }, take: 1 },
          classifications: { where: { modelVersion: BILL_EXTRACTOR_VERSION }, orderBy: { createdAt: "desc" }, take: 1, select: { extractedFields: true } },
        },
      },
    },
  });
}

// POST /api/orgs/[orgId]/bill-inbox/[itemId] — read the emailed bill (once).
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, itemId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const item = await loadItem(orgId, itemId);
    if (!item) return apiError("NOT_FOUND", "Inbox item not found.", 404);
    const existing = item.evidenceFile.classifications[0]?.extractedFields;
    if (existing) return NextResponse.json({ evidenceId: item.evidenceFile.id, ...(existing as object) });
    const buffer = await getObject(item.evidenceFile.storageKey);
    const read = await readBill(orgId, session.user.id, { id: item.evidenceFile.id, mimeType: item.evidenceFile.mimeType }, buffer);
    return NextResponse.json({ evidenceId: item.evidenceFile.id, ...read });
  } catch (err) {
    if (err instanceof DocumentReadError) return apiError(err.code, err.message, 422);
    return handleRouteError(err);
  }
}

const patchSchema = z.object({ status: z.enum(["attached", "dismissed"]) });

// PATCH /api/orgs/[orgId]/bill-inbox/[itemId] — mark attached (once the file is on a record) or dismissed.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { orgId, itemId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const { status } = patchSchema.parse(await req.json());
    const item = await loadItem(orgId, itemId);
    if (!item) return apiError("NOT_FOUND", "Inbox item not found.", 404);
    if (status === "attached" && item.evidenceFile.recordEvidence.length === 0) {
      return apiError("NOT_ATTACHED", "Attach the bill to a record first.", 409);
    }
    await prisma.billInboxItem.update({ where: { id: item.id }, data: { status, resolvedAt: new Date() } });
    if (status === "dismissed") {
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "evidence.inbox_dismissed",
        resourceType: "evidence_file",
        resourceId: item.evidenceFile.id,
      });
    }
    return NextResponse.json({ id: item.id, status });
  } catch (err) {
    if (err instanceof DocumentReadError) return apiError(err.code, err.message, 422);
    return handleRouteError(err);
  }
}
