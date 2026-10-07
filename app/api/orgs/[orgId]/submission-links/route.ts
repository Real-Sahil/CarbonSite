export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { orgRefsError } from "@/lib/security/org-refs";
import { LINK_ISSUERS, createLinkSchema, newLinkToken } from "@/lib/evidence/submission-link";
import { hashToken } from "@/lib/management-systems/auditor-access";

type Params = { params: Promise<{ orgId: string }> };

// GET: the organisation's links (never the token).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...LINK_ISSUERS);
    const links = await prisma.submissionLink.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, label: true, purpose: true, projectId: true, expiresAt: true, revokedAt: true, createdAt: true, lastUsedAt: true, uploadCount: true },
    });
    const projects = await prisma.project.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true },
    });
    const name = new Map(projects.map((p) => [p.id, p.name]));
    return NextResponse.json({
      projects,
      links: links.map((l) => ({ ...l, projectName: l.projectId ? (name.get(l.projectId) ?? null) : null })),
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST: issue a link. The URL is returned once; only its hash is kept.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...LINK_ISSUERS);
    const body = createLinkSchema.parse(await req.json());
    const refs = await orgRefsError(orgId, { projectId: body.projectId });
    if (refs) return refs;
    const token = newLinkToken();
    const link = await prisma.submissionLink.create({
      data: {
        organizationId: orgId,
        label: body.label,
        purpose: body.purpose,
        projectId: body.projectId ?? null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + body.days * 86_400_000),
        createdByUserId: session.user.id,
      },
      select: { id: true, expiresAt: true },
    });
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "evidence.link_created",
      resourceType: "SubmissionLink",
      resourceId: link.id,
      metadata: { label: body.label, purpose: body.purpose, projectId: body.projectId ?? null, days: body.days },
    });
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
    return NextResponse.json({ id: link.id, expiresAt: link.expiresAt, url: `${base}/submit/${token}` }, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
