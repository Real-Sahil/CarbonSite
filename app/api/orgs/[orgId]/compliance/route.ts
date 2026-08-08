import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { handleRouteError, apiError } from "@/lib/validation/api";

const UpsertSchema = z.object({
  framework:     z.string().min(1).max(100),
  reportingYear: z.number().int().min(2000).max(2100),
  status:        z.enum(["draft", "in_progress", "submitted", "verified"]).default("draft"),
  dueDate:       z.string().datetime().optional(),
  notes:         z.string().max(5000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor", "viewer", "auditor");

    const records = await prisma.complianceRecord.findMany({
      where: { organizationId: orgId },
      orderBy: [{ reportingYear: "desc" }, { framework: "asc" }],
    });

    return NextResponse.json({ data: records });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "editor");

    const body = UpsertSchema.safeParse(await req.json());
    if (!body.success) {
      return apiError("VALIDATION_ERROR", "Invalid compliance data", 400, body.error.flatten());
    }

    const record = await prisma.complianceRecord.upsert({
      where: {
        organizationId_framework_reportingYear: {
          organizationId: orgId,
          framework: body.data.framework,
          reportingYear: body.data.reportingYear,
        },
      },
      create: {
        organizationId: orgId,
        framework: body.data.framework,
        reportingYear: body.data.reportingYear,
        status: body.data.status,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : null,
        notes: body.data.notes ?? null,
        submittedAt: body.data.status === "submitted" ? new Date() : null,
      },
      update: {
        status: body.data.status,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : null,
        notes: body.data.notes ?? null,
        submittedAt: body.data.status === "submitted" ? new Date() : undefined,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
