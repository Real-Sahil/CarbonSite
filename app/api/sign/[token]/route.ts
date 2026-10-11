export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { stampAcknowledgment } from "@/lib/integrations/pdf-signer";
import { getObject, putObject } from "@/lib/storage";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/sign/[token]
 * Public endpoint — validate the token and return report metadata for the signing page.
 * No auth required; the token itself is the credential.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const record = await prisma.documentSignatureRequest.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        signatoryName: true,
        signatoryEmail: true,
        tokenExpiresAt: true,
        report: { select: { id: true, type: true, organization: { select: { name: true } } } },
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", "Signing link not found or already used.", 404);
    }

    if (record.status === "signed") {
      return apiError("ALREADY_SIGNED", "This document has already been acknowledged.", 409);
    }
    if (record.status === "declined") {
      return apiError("DECLINED", "This acknowledgment was declined.", 409);
    }
    if (record.tokenExpiresAt && record.tokenExpiresAt < new Date()) {
      return apiError("EXPIRED", "This signing link has expired.", 410);
    }

    return NextResponse.json({
      requestId: record.id,
      signatoryName: record.signatoryName,
      signatoryEmail: record.signatoryEmail,
      expiresAt: record.tokenExpiresAt?.toISOString() ?? null,
      report: {
        id: record.report.id,
        type: record.report.type,
        organizationName: record.report.organization.name,
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const actionSchema = z.object({
  action: z.enum(["acknowledge", "decline"]),
});

/**
 * POST /api/sign/[token]
 * Public endpoint — record the signatory's action.
 *
 * On acknowledge:
 *   1. Records IP, user agent, timestamp in DocumentSignatureRequest
 *   2. Downloads the report PDF from R2
 *   3. Stamps it with @signpdf/signpdf (visual + optional P12 crypto sig)
 *   4. Uploads signed PDF back to R2
 *   5. Nullifies the token so the link cannot be reused
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;
    const body = actionSchema.parse(await req.json());

    const record = await prisma.documentSignatureRequest.findUnique({
      where: { token },
      select: {
        id: true,
        organizationId: true,
        status: true,
        signatoryName: true,
        signatoryEmail: true,
        tokenExpiresAt: true,
        reportId: true,
        report: { select: { id: true, pdfStorageKey: true } },
      },
    });

    if (!record) {
      return apiError("NOT_FOUND", "Signing link not found or already used.", 404);
    }
    if (record.status === "signed" || record.status === "declined") {
      return apiError("ALREADY_ACTED", "This acknowledgment has already been completed.", 409);
    }
    if (record.tokenExpiresAt && record.tokenExpiresAt < new Date()) {
      return apiError("EXPIRED", "This signing link has expired.", 410);
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "";
    const now = new Date();

    if (body.action === "decline") {
      await prisma.documentSignatureRequest.update({
        where: { id: record.id },
        data: { status: "declined", declinedAt: now, token: null },
      });

      await writeAuditLog({
        organizationId: record.organizationId,
        actorUserId: null,
        action: "report.signature_declined",
        resourceType: "document_signature_request",
        resourceId: record.id,
        metadata: { reportId: record.reportId, signatoryEmail: record.signatoryEmail },
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json({ status: "declined" });
    }

    // Acknowledge: stamp the PDF and store it
    let signedPdfKey: string | null = null;

    const reportR2Key = record.report.pdfStorageKey;
    if (reportR2Key) {
      try {
        const pdfBytes = await getObject(reportR2Key);
        const stamped = await stampAcknowledgment({
          pdfBytes: Buffer.from(pdfBytes),
          signatoryName: record.signatoryName,
          signatoryEmail: record.signatoryEmail,
          acknowledgedAt: now,
          ip,
          reportId: record.reportId,
          requestId: record.id,
        });

        signedPdfKey = `org/${record.organizationId}/reports/${record.reportId}/signed_${record.id}.pdf`;
        await putObject(signedPdfKey, stamped, "application/pdf");
      } catch (err) {
        console.error("[sign] PDF stamping failed — acknowledging without signed PDF:", err);
      }
    }

    await prisma.documentSignatureRequest.update({
      where: { id: record.id },
      data: {
        status: "signed",
        signedAt: now,
        acknowledgedIp: ip,
        acknowledgedUserAgent: userAgent.slice(0, 500),
        signedPdfKey,
        token: null,
      },
    });

    await writeAuditLog({
      organizationId: record.organizationId,
      actorUserId: null,
      action: "report.signature_signed",
      resourceType: "document_signature_request",
      resourceId: record.id,
      metadata: {
        reportId: record.reportId,
        signatoryEmail: record.signatoryEmail,
        signedPdfKey: signedPdfKey ?? "none",
      },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({ status: "signed" });
  } catch (err) {
    return handleRouteError(err);
  }
}
