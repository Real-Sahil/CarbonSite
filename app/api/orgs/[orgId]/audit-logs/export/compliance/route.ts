export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { generateComplianceEvidence, createCompliancePDF } from "@/lib/compliance/evidence-generator";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(
  req: NextRequest,
  { params }: Params
) {
  try {
    const { orgId } = await params;

    // Require auditor or admin role
    await requireOrgMember(orgId, "admin", "auditor");

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const snapshotId = searchParams.get("snapshotId");
    const frameworks = searchParams.getAll("frameworks") as Array<"csrd" | "sbti" | "cdp" | "ghg-protocol" | "iso-14064">;

    if (!snapshotId) {
      return apiError("MISSING_PARAM", "snapshotId is required", 400);
    }

    if (frameworks.length === 0) {
      return apiError("MISSING_PARAM", "At least one framework is required", 400);
    }

    // Verify snapshot belongs to org
    const snapshot = await prisma.publishedSnapshot.findFirst({
      where: {
        id: snapshotId,
        calculationRun: { organizationId: orgId },
      },
    });

    if (!snapshot) {
      return apiError("NOT_FOUND", "Snapshot not found", 404);
    }

    // Generate compliance evidence
    const evidence = await generateComplianceEvidence(
      orgId,
      snapshot.id,
      {
        frameworks,
        includeCalculations: true,
        includeAuditTrail: true,
      }
    );

    // Create PDF
    const pdfBuffer = await createCompliancePDF(evidence);

    // Return PDF with compliance headers
    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compliance-evidence-${snapshotId}-${new Date().toISOString().split('T')[0]}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
