export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { z } from "zod";

const anomalyFilterSchema = z.object({
  severity: z.enum(["info", "warning", "critical"]).optional(),
  type: z.string().optional(),
  resolution: z.enum(["pending", "approved", "rejected"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const resolveAnomalySchema = z.object({
  anomalyIds: z.array(z.string()).min(1),
  resolution: z.enum(["approved", "rejected"]),
  notes: z.string().optional(),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const url = new URL(req.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());
    const filters = anomalyFilterSchema.parse(searchParams);

    const where: any = {
      invoice: { organizationId: orgId },
    };

    if (filters.severity) {
      where.severity = filters.severity;
    }
    if (filters.type) {
      where.anomalyType = filters.type;
    }
    if (filters.resolution) {
      where.resolution = filters.resolution;
    }

    const anomalies = await prisma.invoiceAnomaly.findMany({
      where,
      include: {
        invoice: {
          select: {
            id: true,
            externalInvoiceId: true,
            vendorName: true,
            totalAmount: true,
            invoiceDate: true,
          },
        },
        resolvedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { detectedAt: "desc" },
      take: filters.limit + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
    });

    const hasMore = anomalies.length > filters.limit;
    const items = anomalies.slice(0, filters.limit);
    const nextCursor = hasMore ? items[items.length - 1]?.id : null;

    return json(
      {
        anomalies: items,
        pagination: {
          nextCursor,
          hasMore,
          limit: filters.limit,
        },
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;
    const { version, json } = await withApiVersion(req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    const { session } = await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const rawBody = await req.json().catch(() => null);
    if (!rawBody) return apiError("INVALID_BODY", "Request body must be valid JSON.", 400);

    const body = resolveAnomalySchema.safeParse(rawBody);
    if (!body.success) {
      return apiError("VALIDATION_ERROR", "Invalid request body.", 400, body.error.flatten());
    }

    const anomalies = await prisma.invoiceAnomaly.findMany({
      where: {
        id: { in: body.data.anomalyIds },
      },
      include: { invoice: { select: { organizationId: true } } },
    });

    for (const anomaly of anomalies) {
      if (anomaly.invoice.organizationId !== orgId) {
        return apiError("UNAUTHORIZED", "Anomaly not found in this organization.", 403);
      }
    }

    const updated = await Promise.all(
      body.data.anomalyIds.map((id) =>
        prisma.invoiceAnomaly.update({
          where: { id },
          data: {
            resolution: body.data.resolution,
            resolutionNotes: body.data.notes,
            resolvedByUserId: session.user.id,
            resolvedAt: new Date(),
          },
          include: {
            invoice: {
              select: {
                id: true,
                externalInvoiceId: true,
                vendorName: true,
              },
            },
          },
        })
      )
    );

    return json(
      {
        message: `${updated.length} anomalies resolved as ${body.data.resolution}`,
        updated,
      },
      { version }
    );
  } catch (err) {
    return handleRouteError(err);
  }
}
