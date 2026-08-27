import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgMember } from "@/lib/auth/session";
import {
  generateCSRDCompliance,
  getCSRDCategoryMapping,
  getAllCSRDCategoryMappings,
} from "@/lib/compliance/csrd-mapper";
import { handleRouteError } from "@/lib/validation/api";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/db/audit";

const csrdComplianceSchema = z.object({
  reportingYear: z.number().min(2024).max(2050),
  scope1: z.number().min(0).optional(),
  scope2: z.number().min(0).optional(),
  scope3: z.number().min(0).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params;
    await requireOrgMember(orgId, "admin", "auditor");

    const body = await req.json();
    const input = csrdComplianceSchema.parse(body);

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Organization not found" },
        { status: 404 },
      );
    }

    const compliance = generateCSRDCompliance({
      organizationId: orgId,
      reportingYear: input.reportingYear,
      scope1: input.scope1,
      scope2: input.scope2,
      scope3: input.scope3,
    });

    // Log compliance assessment
    await writeAuditLog({
      organizationId: orgId,
      action: "compliance.csrd_assessed",
      resourceType: "CSRDCompliance",
      resourceId: `${input.reportingYear}`,
      metadata: {
        reportingYear: input.reportingYear,
        complianceStatus: compliance.complianceStatus,
        scope1: input.scope1,
        scope2: input.scope2,
        scope3: input.scope3,
        totalEmissions: compliance.totalEmissions,
      },
    });

    return NextResponse.json(
      {
        success: true,
        compliance,
      },
      { status: 200 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  try {
    const { orgId } = params;
    await requireOrgMember(orgId, "admin", "auditor", "viewer");

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    if (category) {
      // Get specific category mapping
      const mapping = getCSRDCategoryMapping(category);
      if (!mapping) {
        return NextResponse.json(
          { code: "NOT_FOUND", message: `Category ${category} not found` },
          { status: 404 },
        );
      }
      return NextResponse.json({ mapping });
    }

    // Get all category mappings
    const mappings = getAllCSRDCategoryMappings();
    return NextResponse.json({
      mappings,
      count: mappings.length,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
