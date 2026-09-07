export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const TOKEN_TTL_DAYS = 7;

const createRequestSchema = z.object({
  signatoryEmail: z.string().email(),
  signatoryName: z.string().min(1).max(200),
});

/**
 * POST /api/orgs/[orgId]/reports/[reportId]/signature-request
 * Create an acknowledgment request for an audit report.
 * Sends the signatory a one-time link; no external service required.
 * Admins only.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createRequestSchema.parse(await req.json());

    const report = await prisma.report.findFirst({
      where: { id: reportId, organizationId: orgId },
      select: { id: true, type: true, status: true },
    });

    if (!report) {
      return apiError("NOT_FOUND", "Report not found.", 404);
    }

    if (report.status !== "ready") {
      return apiError(
        "REPORT_NOT_READY",
        "Signature requests can only be created for completed (ready) reports.",
        422,
      );
    }

    const token = randomUUID();
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);

    const record = await prisma.documentSignatureRequest.create({
      data: {
        organizationId: orgId,
        reportId,
        signatoryEmail: body.signatoryEmail,
        signatoryName: body.signatoryName,
        token,
        tokenExpiresAt,
        requestedByUserId: session.user.id,
        status: "sent",
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "report.signature_request_created",
      resourceType: "document_signature_request",
      resourceId: record.id,
      metadata: {
        reportId,
        signatoryEmail: body.signatoryEmail,
        expiresAt: tokenExpiresAt.toISOString(),
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const signingLink = `${appUrl}/sign/${token}`;

    return NextResponse.json(
      {
        id: record.id,
        status: record.status,
        signatoryEmail: record.signatoryEmail,
        signatoryName: record.signatoryName,
        signingLink,
        expiresAt: tokenExpiresAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * GET /api/orgs/[orgId]/reports/[reportId]/signature-request
 * List all acknowledgment requests for this report.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const records = await prisma.documentSignatureRequest.findMany({
      where: { organizationId: orgId, reportId },
      orderBy: { createdAt: "desc" },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    return NextResponse.json(
      records.map((r) => ({
        id: r.id,
        status: r.status,
        signatoryEmail: r.signatoryEmail,
        signatoryName: r.signatoryName,
        signingLink: r.token ? `${appUrl}/sign/${r.token}` : null,
        expired: r.tokenExpiresAt ? r.tokenExpiresAt < new Date() : false,
        signedAt: r.signedAt?.toISOString() ?? null,
        declinedAt: r.declinedAt?.toISOString() ?? null,
        signedPdfKey: r.signedPdfKey ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
