export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit-async";
import { writeAuditLog } from "@/lib/db/audit";
import { sendEmail, supplierDataRequestEmail } from "@/lib/notifications/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://carbonsite-rosy.vercel.app";
const EXPIRES_DAYS = 30;

const resendSchema = z.object({
  token: z.string().min(1),
});

type Params = { params: Promise<{ requestId: string }> };

// POST /api/supplier-portal/requests/[requestId]/resend — resend invitation email
export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimitRequest(req, {
    key: "supplier_portal_resend",
    limit: 5,
    windowMs: 60 * 60 * 1000, // 5 resends per hour
  });
  if (limited) return limited;

  try {
    const { requestId } = await params;
    const body = resendSchema.parse(await req.json());

    // Verify token provides access to this request
    const verifyRequest = await prisma.supplierDataRequest.findUnique({
      where: { token: body.token },
      select: {
        supplierEmail: true,
        organizationId: true,
      },
    });

    if (!verifyRequest) {
      return NextResponse.json(
        { code: "INVALID_TOKEN", message: "Invalid or expired token." },
        { status: 401 },
      );
    }

    // Fetch the request to resend
    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: requestId },
      include: {
        organization: { select: { name: true } },
        reportingPeriod: { select: { label: true } },
      },
    });

    if (!request) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Request not found." },
        { status: 404 },
      );
    }

    // Verify supplier has access (owns this request)
    if (request.supplierEmail !== verifyRequest.supplierEmail || request.organizationId !== verifyRequest.organizationId) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Access denied." },
        { status: 403 },
      );
    }

    // Don't resend if already submitted
    if (request.status === "submitted" || request.status === "approved" || request.status === "converted") {
      return NextResponse.json(
        { code: "INVALID_STATE", message: "This request has already been submitted." },
        { status: 400 },
      );
    }

    // Update expiry date
    const newExpiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await prisma.supplierDataRequest.update({
      where: { id: requestId },
      data: {
        expiresAt: newExpiresAt,
        status: "sent", // Reset to sent state
      },
    });

    // Send email
    const formUrl = `${APP_URL}/supplier-data/${request.token}`;
    await sendEmail({
      to: request.supplierEmail,
      ...supplierDataRequestEmail({
        recipientName: request.supplierName ?? request.supplierEmail,
        orgName: request.organization.name,
        categoryName: request.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
        periodLabel: request.reportingPeriod.label,
        formUrl,
        expiresAt: newExpiresAt,
      }),
    });

    // Audit log
    await writeAuditLog({
      organizationId: request.organizationId,
      actorUserId: null,
      action: "supplier_data_request.resent",
      resourceType: "SupplierDataRequest",
      resourceId: requestId,
      metadata: {
        supplierEmail: request.supplierEmail,
        categoryCode: request.categoryCode,
        newExpiresAt: newExpiresAt.toISOString(),
      },
    });

    return NextResponse.json({
      ok: true,
      expiresAt: newExpiresAt.toISOString(),
      message: "Invitation resent successfully. Check your email.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message },
      { status: 500 },
    );
  }
}
