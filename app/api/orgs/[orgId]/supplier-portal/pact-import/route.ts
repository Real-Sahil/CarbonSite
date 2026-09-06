export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { writeAuditLog } from "@/lib/db/audit";
import { apiError, handleRouteError } from "@/lib/validation/api";

// PACT Scope 3 response schema - what suppliers send back
const PactScope3DataSchema = z.object({
  requestId: z.string().min(1).describe("Reference to original request ID"),
  supplier: z.object({
    name: z.string().describe("Supplier company name"),
    email: z.string().email().describe("Contact email"),
  }),
  emissionFactors: z.array(
    z.object({
      category: z.string().describe("PACT Scope 3 category"),
      value: z.number().positive().describe("Emission factor value"),
      unit: z.string().describe("Unit (kg CO2e per product unit or per £ spend)"),
      dataQuality: z.number().min(0).max(100).describe("Data quality score 0-100"),
      source: z.enum(["primary-data", "supplier-specific", "industry-average", "generic"]),
      methodology: z.string().optional().describe("How the factor was calculated"),
      geographicCoverage: z.string().optional().describe("Geographic scope"),
      temporalCoverage: z.string().optional().describe("Time period covered"),
    }),
  ),
  metadata: z.object({
    responseDate: z.string().datetime(),
    validUntil: z.string().datetime().optional(),
    certifications: z.array(z.string()).optional().describe("e.g., ISO 14067, PAS 2050"),
  }),
});

const PactImportSchema = z.object({
  data: PactScope3DataSchema,
  token: z.string().optional().describe("Invite token or API key for authentication"),
});

/**
 * POST /api/orgs/[orgId]/supplier-portal/pact-import
 * Accept supplier Scope 3 emissions data in PACT/PCF Pathfinder format.
 * Converts PACT response to internal SupplierDataRequest response records.
 *
 * Authentication: API key (admin) or invite token (supplier)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    // Authenticate via API key
    let authenticatedOrgId: string;
    try {
      authenticatedOrgId = await validateApiKey(req.headers.get("authorization"));
    } catch (err) {
      return apiError("UNAUTHORIZED", "Invalid API key", 401);
    }

    // Ensure the key belongs to the requested org
    if (authenticatedOrgId !== orgId) {
      return apiError("FORBIDDEN", "API key does not belong to this organization", 403);
    }

    // Parse and validate request body
    const body = await req.json().catch(() => null);
    if (!body) {
      return apiError("BAD_REQUEST", "Request body must be valid JSON", 400);
    }

    const parsed = PactImportSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Invalid PACT format",
        400,
        parsed.error.flatten(),
      );
    }

    const { data } = parsed.data;

    // Find the original request
    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: data.requestId },
      select: {
        id: true,
        organizationId: true,
        categoryCode: true,
      },
    });

    if (!request || request.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Original request not found", 404);
    }

    // Store the PACT response data in submittedData field
    const response = await prisma.supplierDataRequest.update({
      where: { id: data.requestId },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        submittedData: {
          format: "pact-pathfinder-3.0",
          supplier: data.supplier,
          emissionFactors: data.emissionFactors.map((ef) => ({
            category: mapPactCategoryToInternal(ef.category),
            value: ef.value,
            unit: ef.unit,
            dataQuality: ef.dataQuality,
            source: ef.source,
            methodology: ef.methodology,
            geographicCoverage: ef.geographicCoverage,
            temporalCoverage: ef.temporalCoverage,
          })),
          metadata: data.metadata,
        },
      },
      select: {
        id: true,
        status: true,
        categoryCode: true,
      },
    });

    // Audit log the response receipt
    await writeAuditLog({
      organizationId: orgId,
      actorUserId: undefined, // Supplier portal submission, no user
      action: "supplier_data_request.submitted",
      resourceType: "SupplierDataRequest",
      resourceId: data.requestId,
      metadata: {
        supplierName: data.supplier.name,
        factorCount: data.emissionFactors.length,
        format: "pact-pathfinder-3.0",
      },
    }).catch(() => null);

    return NextResponse.json(
      {
        success: true,
        requestId: response.id,
        status: response.status,
        message: `PACT data received for category ${response.categoryCode}. ${data.emissionFactors.length} emission factors processed.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Map PACT Scope 3 categories to MetricOra category codes.
 */
function mapPactCategoryToInternal(pactCategory: string): string {
  const mapping: Record<string, string> = {
    "purchased-goods-services": "s3-purchased-goods",
    "capital-goods": "s3-capital-goods",
    "fuel-energy-not-included-in-scope": "s3-fuel-energy",
    "upstream-transportation-distribution": "s3-upstream-transport",
    "waste-generated-operations": "s3-waste",
    "business-travel": "s3-business-travel",
    "employee-commuting": "s3-commuting",
    "upstream-leased-assets": "s3-upstream-leased",
    "downstream-transportation-distribution": "s3-downstream-transport",
    "processing-sold-products": "s3-processing",
    "use-sold-products": "s3-use-sold",
    "end-of-life-sold-products": "s3-end-of-life",
    "downstream-leased-assets": "s3-downstream-leased",
    "franchises": "s3-franchises",
    "investments": "s3-investments",
  };

  return mapping[pactCategory] || "s3-purchased-goods";
}
