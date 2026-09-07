export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import type { SignatureRequestStatus } from "@prisma/client";
import { createSubmission, getSubmission, DocuSealError } from "@/lib/integrations/docuseal";

type Params = { params: Promise<{ orgId: string; reportId: string }> };

const createRequestSchema = z.object({
  signatoryEmail: z.string().email(),
  signatoryName: z.string().min(1).max(200),
  /**
   * DocuSeal template ID for audit report sign-off.
   * Stored in the DOCUSEAL_TEMPLATE_ID env var if you have a single org-wide template,
   * or passed per-request for multi-template setups.
   */
  templateId: z.number().int().positive().optional(),
  completedRedirectUrl: z.string().url().optional(),
});

/**
 * POST /api/orgs/[orgId]/reports/[reportId]/signature-request
 * Create a DocuSeal signature request for an audit report package.
 * Admins only.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createRequestSchema.parse(await req.json());

    const templateId =
      body.templateId ??
      (process.env.DOCUSEAL_TEMPLATE_ID ? parseInt(process.env.DOCUSEAL_TEMPLATE_ID, 10) : undefined);

    if (!templateId) {
      return apiError(
        "DOCUSEAL_TEMPLATE_NOT_CONFIGURED",
        "No DocuSeal template ID configured. Set DOCUSEAL_TEMPLATE_ID or pass templateId in the request body.",
        422,
      );
    }

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

    let submission;
    try {
      submission = await createSubmission({
        templateId,
        submitters: [{ email: body.signatoryEmail, name: body.signatoryName }],
        fields: { report_type: report.type, report_id: reportId },
        completedRedirectUrl: body.completedRedirectUrl,
      });
    } catch (err) {
      if (err instanceof DocuSealError) {
        return apiError("DOCUSEAL_ERROR", err.message, 502);
      }
      throw err;
    }

    const firstSubmitter = submission.submitters[0];

    const record = await prisma.documentSignatureRequest.create({
      data: {
        organizationId: orgId,
        reportId,
        signatoryEmail: body.signatoryEmail,
        signatoryName: body.signatoryName,
        docusealSubmissionId: submission.id,
        docusealSigningUrl: firstSubmitter?.embed_src ?? null,
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
        docusealSubmissionId: submission.id,
      },
    });

    return NextResponse.json(
      {
        id: record.id,
        status: record.status,
        signatoryEmail: record.signatoryEmail,
        signatoryName: record.signatoryName,
        signingUrl: record.docusealSigningUrl,
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
 * List all signature requests for this report, refreshing live status from DocuSeal.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId, reportId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const records = await prisma.documentSignatureRequest.findMany({
      where: { organizationId: orgId, reportId },
      orderBy: { createdAt: "desc" },
    });

    const results = await Promise.all(
      records.map(async (r) => {
        if (!r.docusealSubmissionId || r.status === "signed" || r.status === "declined") {
          return r;
        }

        try {
          const live = await getSubmission(r.docusealSubmissionId);
          const submitter = live.submitters[0];

          let newStatus: SignatureRequestStatus = r.status ?? "pending";
          let signedAt = r.signedAt;
          let declinedAt = r.declinedAt;

          if (submitter?.status === "completed") {
            newStatus = "signed";
            signedAt = submitter.completed_at ? new Date(submitter.completed_at) : new Date();
          } else if (submitter?.status === "declined") {
            newStatus = "declined";
            declinedAt = new Date();
          }

          if (newStatus !== r.status) {
            const updated = await prisma.documentSignatureRequest.update({
              where: { id: r.id },
              data: { status: newStatus, signedAt, declinedAt },
            });
            return updated;
          }
        } catch {
          // DocuSeal unavailable — return cached state
        }

        return r;
      }),
    );

    return NextResponse.json(
      results.map((r) => ({
        id: r.id,
        status: r.status,
        signatoryEmail: r.signatoryEmail,
        signatoryName: r.signatoryName,
        signingUrl: r.docusealSigningUrl,
        signedAt: r.signedAt?.toISOString() ?? null,
        declinedAt: r.declinedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
