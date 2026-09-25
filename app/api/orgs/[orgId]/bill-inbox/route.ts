export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { inboxAddress, inboxDomain, newInboxToken } from "@/lib/evidence/bill-inbox";
import { BILL_EXTRACTOR_VERSION } from "@/lib/evidence/bill-extractor";

type Params = { params: Promise<{ orgId: string }> };

// GET /api/orgs/[orgId]/bill-inbox — the inbox address and bills waiting to be matched.
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const [org, items] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { billInboxToken: true } }),
      prisma.billInboxItem.findMany({
        where: { organizationId: orgId, status: "pending" },
        orderBy: { receivedAt: "desc" },
        take: 50,
        select: {
          id: true,
          fromAddress: true,
          subject: true,
          receivedAt: true,
          evidenceFile: {
            select: {
              id: true,
              filename: true,
              classifications: { where: { modelVersion: BILL_EXTRACTOR_VERSION }, orderBy: { createdAt: "desc" }, take: 1, select: { extractedFields: true } },
            },
          },
        },
      }),
    ]);
    return NextResponse.json({
      configured: inboxDomain() != null,
      address: inboxAddress(org?.billInboxToken),
      items: items.map((i) => ({
        id: i.id,
        from: i.fromAddress,
        subject: i.subject,
        receivedAt: i.receivedAt.toISOString(),
        evidenceId: i.evidenceFile.id,
        filename: i.evidenceFile.filename,
        read: i.evidenceFile.classifications[0]?.extractedFields ?? null,
      })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const postSchema = z.object({ rotate: z.boolean().optional() });

// POST /api/orgs/[orgId]/bill-inbox — turn the inbox on, or give it a new address.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.editor);
    const body = postSchema.parse(await req.json().catch(() => ({})));
    const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { billInboxToken: true } });
    let token = org?.billInboxToken ?? null;
    if (!token || body.rotate) {
      token = newInboxToken();
      await prisma.organization.update({ where: { id: orgId }, data: { billInboxToken: token } });
      await writeAuditLog({
        organizationId: orgId,
        actorUserId: session.user.id,
        action: "evidence.inbox_enabled",
        resourceType: "organization",
        resourceId: orgId,
        metadata: { rotated: !!org?.billInboxToken },
      });
    }
    return NextResponse.json({ configured: inboxDomain() != null, address: inboxAddress(token) });
  } catch (err) {
    return handleRouteError(err);
  }
}
