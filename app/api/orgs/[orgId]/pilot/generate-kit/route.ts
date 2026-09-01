import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import {
  generateExecutiveSummary,
  generateSustainabilityManagerGuide,
  generateFinanceLeadGuide,
  generateFieldWorkerGuide,
  generateTechnicalIntegrationGuide,
  generateComplianceGuide,
  type PilotClientContext,
} from "@/lib/pilot/pdf-kit-generator";
import { prisma } from "@/lib/db";
import { putObject } from "@/lib/storage";
import { writeAuditLog } from "@/lib/db/audit";
import { z } from "zod";

// Validation schema for PilotClientContext
const PilotClientContextSchema = z.object({
  organizationId: z.string().min(1),
  organizationName: z.string().min(1).max(255),
  industry: z.string().min(1).max(100),
  facilityCount: z.number().int().positive(),
  facilityNames: z.array(z.string()).min(1),
  accountingSystem: z.string().optional(),
  stakeholders: z.object({
    sustainabilityLead: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.string().min(1),
    }),
    financeLead: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      role: z.string().min(1),
    }),
    itAdmin: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    externalAuditor: z.object({
      name: z.string().min(1),
      firm: z.string().min(1),
      email: z.string().email(),
    }).optional(),
  }),
  complianceFrameworks: z.array(z.enum(["CSRD", "SBTi", "CDP", "GHG-Protocol"])).min(1),
  timelineDays: z.number().int().min(30).max(365),
  pilotStartDate: z.string().datetime(),
  supplierCount: z.number().int().nonnegative(),
  fieldWorkerCount: z.number().int().nonnegative(),
  reportingCurrency: z.string().length(3).regex(/^[A-Z]{3}$/),
  timezone: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Authorization: admin or editor role only (PDFs are sensitive setup docs)
    await requireOrgMember(orgId, "admin", "editor");

    // Parse and validate request body
    const body = await req.json();
    const contextData = PilotClientContextSchema.parse(body);

    // Verify orgId matches
    if (contextData.organizationId !== orgId) {
      return NextResponse.json(
        { code: "INVALID_ORG", message: "Organization ID mismatch" },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { code: "ORG_NOT_FOUND", message: "Organization not found" },
        { status: 404 }
      );
    }

    // Convert ISO string to Date for PilotClientContext
    const context: PilotClientContext = {
      ...contextData,
      pilotStartDate: new Date(contextData.pilotStartDate),
    };

    // Generate all 6 PDFs
    const [
      executiveSummaryPdf,
      sustainabilityManagerPdf,
      financeLeadPdf,
      fieldWorkerPdf,
      technicalIntegrationPdf,
      compliancePdf,
    ] = await Promise.all([
      generateExecutiveSummary(context),
      generateSustainabilityManagerGuide(context),
      generateFinanceLeadGuide(context),
      generateFieldWorkerGuide(context),
      generateTechnicalIntegrationGuide(context),
      generateComplianceGuide(context),
    ]);

    // Upload PDFs to R2 storage
    const timestamp = new Date().toISOString().split("T")[0];
    const uploadResults = await Promise.all([
      putObject(
        `org/${orgId}/pilot-kit/01-executive-summary-${timestamp}.pdf`,
        executiveSummaryPdf,
        "application/pdf"
      ),
      putObject(
        `org/${orgId}/pilot-kit/02-sustainability-manager-${timestamp}.pdf`,
        sustainabilityManagerPdf,
        "application/pdf"
      ),
      putObject(
        `org/${orgId}/pilot-kit/03-finance-lead-${timestamp}.pdf`,
        financeLeadPdf,
        "application/pdf"
      ),
      putObject(
        `org/${orgId}/pilot-kit/04-field-worker-${timestamp}.pdf`,
        fieldWorkerPdf,
        "application/pdf"
      ),
      putObject(
        `org/${orgId}/pilot-kit/05-technical-integration-${timestamp}.pdf`,
        technicalIntegrationPdf,
        "application/pdf"
      ),
      putObject(
        `org/${orgId}/pilot-kit/06-compliance-guide-${timestamp}.pdf`,
        compliancePdf,
        "application/pdf"
      ),
    ]);

    // Log to audit trail
    await writeAuditLog({
      organizationId: orgId,
      action: "pilot.kit_generated",
      actorUserId: req.headers.get("x-user-id") || "system",
      resourceType: "pilot_kit",
      resourceId: orgId,
      metadata: {
        context: {
          organizationName: context.organizationName,
          industry: context.industry,
          facilityCount: context.facilityCount,
          complianceFrameworks: context.complianceFrameworks,
        },
        uploadedFiles: 6,
        timestamp,
      },
    });

    return NextResponse.json(
      {
        code: "PILOT_KIT_GENERATED",
        message: "Pilot client documentation kit generated successfully",
        data: {
          organizationId: orgId,
          organizationName: context.organizationName,
          generatedAt: new Date().toISOString(),
          documents: [
            {
              name: "Executive Summary",
              storageKey: uploadResults[0],
              audience: "Executive Stakeholders",
            },
            {
              name: "Sustainability Manager Guide",
              storageKey: uploadResults[1],
              audience: "Sustainability Lead",
            },
            {
              name: "Finance Lead Guide",
              storageKey: uploadResults[2],
              audience: "Finance Lead",
            },
            {
              name: "Field Worker Guide",
              storageKey: uploadResults[3],
              audience: "Field Workers",
            },
            {
              name: "Technical Integration Guide",
              storageKey: uploadResults[4],
              audience: "IT Administrator",
            },
            {
              name: "Compliance Guide",
              storageKey: uploadResults[5],
              audience: "Compliance & Audit",
            },
          ],
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof z.ZodError) {
      const details = error.errors.map((e) => {
        const detail: any = {
          path: e.path.join("."),
          message: e.message,
          code: e.code,
        };
        // Add received value if available (varies by error type)
        if ("received" in e) {
          detail.received = (e as any).received?.toString();
        }
        return detail;
      });
      console.error("[PILOT-KIT] Validation errors:", JSON.stringify(details, null, 2));
      return NextResponse.json(
        {
          code: "VALIDATION_ERROR",
          message: "Invalid pilot client context",
          details,
        },
        { status: 400 }
      );
    }

    console.error("[PILOT-KIT] Generation error:", error);
    return NextResponse.json(
      {
        code: "GENERATION_ERROR",
        message: "Failed to generate pilot documentation kit",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve generated kit metadata for an organization
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Authorization: admin or editor only
    await requireOrgMember(orgId, "admin", "editor");

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, createdAt: true },
    });

    if (!org) {
      return NextResponse.json(
        { code: "ORG_NOT_FOUND", message: "Organization not found" },
        { status: 404 }
      );
    }

    // Query audit log for most recent kit generation
    const recentGeneration = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgId,
        action: "pilot_kit_generated",
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        metadata: true,
      },
    });

    return NextResponse.json(
      {
        code: "OK",
        data: {
          organizationId: orgId,
          organizationName: org.name,
          organizationCreatedAt: org.createdAt,
          lastKitGeneration: recentGeneration?.createdAt || null,
          lastGenerationContext:
            (typeof recentGeneration?.metadata === 'object' &&
             recentGeneration?.metadata !== null &&
             'context' in recentGeneration.metadata)
              ? recentGeneration.metadata.context
              : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: error.message },
        { status: error.status }
      );
    }

    console.error("[PILOT-KIT] Metadata retrieval error:", error);
    return NextResponse.json(
      {
        code: "RETRIEVAL_ERROR",
        message: "Failed to retrieve pilot kit metadata",
      },
      { status: 500 }
    );
  }
}
