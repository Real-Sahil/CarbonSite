export const dynamic = "force-dynamic";

// Public token-gated endpoints for supplier data submission.
// No session auth — the token IS the credential.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimitRequest } from "@/lib/security/rate-limit";
import { writeAuditLog } from "@/lib/db/audit";

const UNIT_OPTIONS = ["kg", "tonne", "kWh", "MWh", "litre", "m3", "GBP", "piece"] as const;

const submitSchema = z.object({
  quantity: z.number().positive(),
  unit: z.enum(UNIT_OPTIONS),
  description: z.string().max(500).trim().optional(),
  supplierName: z.string().max(200).trim().optional(),
});

type Params = { params: Promise<{ token: string }> };

async function resolveRequest(token: string) {
  return prisma.supplierDataRequest.findUnique({
    where: { token },
    select: {
      id: true,
      organizationId: true,
      reportingPeriodId: true,
      supplierEmail: true,
      supplierName: true,
      categoryCode: true,
      status: true,
      expiresAt: true,
      notes: true,
      reportingPeriod: { select: { label: true, startDate: true, endDate: true } },
      organization: { select: { name: true } },
    },
  });
}

// GET — return form metadata (also records first open)
export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const request = await resolveRequest(token);
  if (!request) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Data request not found." }, { status: 404 });
  }

  const now = new Date();
  if (request.expiresAt <= now) {
    return NextResponse.json({ code: "EXPIRED", message: "This data request has expired." }, { status: 410 });
  }
  if (request.status === "submitted") {
    return NextResponse.json({ code: "ALREADY_SUBMITTED", message: "You have already submitted data for this request." }, { status: 409 });
  }

  // Mark as opened on first access (fire-and-forget, non-blocking)
  if (request.status === "sent") {
    prisma.supplierDataRequest
      .update({ where: { id: request.id }, data: { status: "opened", openedAt: now } })
      .catch(() => {});
  }

  return NextResponse.json({
    orgName: request.organization.name,
    categoryCode: request.categoryCode,
    categoryName: request.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
    periodLabel: request.reportingPeriod.label,
    periodStart: request.reportingPeriod.startDate.toISOString(),
    periodEnd: request.reportingPeriod.endDate.toISOString(),
    notes: request.notes,
    units: UNIT_OPTIONS,
    expiresAt: request.expiresAt.toISOString(),
  });
}

// POST — submit data
export async function POST(req: NextRequest, { params }: Params) {
  const limited = await rateLimitRequest(req, {
    key: "supplier_data_submit",
    limit: 10,
    windowMs: 15 * 60_000,
  });
  if (limited) return limited;

  const { token } = await params;

  const request = await resolveRequest(token);
  if (!request) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Data request not found." }, { status: 404 });
  }

  const now = new Date();
  if (request.expiresAt <= now) {
    return NextResponse.json({ code: "EXPIRED", message: "This data request has expired." }, { status: 410 });
  }
  if (request.status === "submitted") {
    return NextResponse.json({ code: "ALREADY_SUBMITTED", message: "You have already submitted data for this request." }, { status: 409 });
  }

  const body = submitSchema.safeParse(await req.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid submission.", details: body.error.flatten() },
      { status: 422 },
    );
  }

  const submittedData = {
    quantity: body.data.quantity,
    unit: body.data.unit,
    description: body.data.description ?? null,
    submittedAt: now.toISOString(),
  };

  await prisma.supplierDataRequest.update({
    where: { id: request.id },
    data: {
      status: "submitted",
      submittedAt: now,
      openedAt: request.status === "sent" ? now : undefined,
      submittedData,
      ...(body.data.supplierName ? { supplierName: body.data.supplierName } : {}),
    },
  });

  await writeAuditLog({
    organizationId: request.organizationId,
    actorUserId: null,
    action: "supplier_data_request.submitted",
    resourceType: "SupplierDataRequest",
    resourceId: request.id,
    metadata: {
      categoryCode: request.categoryCode,
      supplierEmail: request.supplierEmail,
      quantity: body.data.quantity,
      unit: body.data.unit,
    },
  });

  return NextResponse.json({ ok: true });
}
