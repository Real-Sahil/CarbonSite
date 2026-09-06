export const dynamic = "force-dynamic";

// Scope 3 supply chain data collection campaigns.
// Admins send targeted emails asking suppliers to self-report spend/activity
// data for a specific emission category and reporting period.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError } from "@/lib/validation/api";
import { sendEmail, supplierDataRequestEmail } from "@/lib/notifications/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://metricora-rosy.vercel.app";
const EXPIRES_DAYS = 30;

const createSchema = z.object({
  reportingPeriodId: z.string().min(1),
  suppliers: z
    .array(
      z.object({
        email: z.string().email().trim().toLowerCase(),
        name: z.string().max(200).trim().optional(),
      }),
    )
    .min(1)
    .max(50),
  categoryCode: z.string().min(1),
  notes: z.string().max(1000).trim().optional(),
});

// GET /api/orgs/[orgId]/supplier-data-requests — list all requests for an org
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const url = new URL(req.url);
    const reportingPeriodId = url.searchParams.get("reportingPeriodId") ?? undefined;

    const requests = await prisma.supplierDataRequest.findMany({
      where: { organizationId: orgId, ...(reportingPeriodId ? { reportingPeriodId } : {}) },
      select: {
        id: true,
        supplierEmail: true,
        supplierName: true,
        categoryCode: true,
        status: true,
        sentAt: true,
        openedAt: true,
        submittedAt: true,
        expiresAt: true,
        reportingPeriod: { select: { label: true } },
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json(
      requests.map((r) => ({
        id: r.id,
        supplierEmail: r.supplierEmail,
        supplierName: r.supplierName,
        categoryCode: r.categoryCode,
        status: r.status,
        sentAt: r.sentAt.toISOString(),
        openedAt: r.openedAt?.toISOString() ?? null,
        submittedAt: r.submittedAt?.toISOString() ?? null,
        expiresAt: r.expiresAt.toISOString(),
        periodLabel: r.reportingPeriod.label,
        sentBy: r.createdBy.name ?? r.createdBy.email,
        expired: r.expiresAt < new Date() && r.status === "sent",
      })),
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

// POST /api/orgs/[orgId]/supplier-data-requests — create and send data requests
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const body = createSchema.parse(await req.json());

    const [period, org] = await Promise.all([
      prisma.reportingPeriod.findFirst({
        where: { id: body.reportingPeriodId, organizationId: orgId },
        select: { id: true, label: true },
      }),
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      }),
    ]);

    if (!period) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Reporting period not found." }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 60 * 60 * 1000);
    const created: string[] = [];
    const failed: string[] = [];

    for (const supplier of body.suppliers) {
      try {
        const request = await prisma.supplierDataRequest.create({
          data: {
            organizationId: orgId,
            reportingPeriodId: period.id,
            supplierEmail: supplier.email,
            supplierName: supplier.name ?? null,
            categoryCode: body.categoryCode,
            expiresAt,
            notes: body.notes ?? null,
            createdByUserId: session.user.id,
          },
        });

        const formUrl = `${APP_URL}/supplier-data/${request.token}`;

        await sendEmail({
          to: supplier.email,
          ...supplierDataRequestEmail({
            recipientName: supplier.name ?? supplier.email,
            orgName: org?.name ?? "a customer",
            categoryName: body.categoryCode.replace(/^s\d-/, "").replace(/-/g, " "),
            periodLabel: period.label,
            formUrl,
            expiresAt,
          }),
        });

        created.push(supplier.email);
      } catch {
        failed.push(supplier.email);
      }
    }

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "supplier_data_request.sent",
      resourceType: "SupplierDataRequest",
      resourceId: body.reportingPeriodId,
      metadata: {
        categoryCode: body.categoryCode,
        sentTo: created,
        failedTo: failed,
        count: created.length,
      },
    });

    return NextResponse.json(
      { sent: created.length, failed: failed.length, sentTo: created, failedTo: failed },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
