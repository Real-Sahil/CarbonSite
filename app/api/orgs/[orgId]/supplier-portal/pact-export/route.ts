export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateApiKey } from "@/lib/auth/api-key";
import { apiError, handleRouteError } from "@/lib/validation/api";

const PactExportSchema = z.object({
  supplierDataRequestId: z.string().min(1).describe("SupplierDataRequest ID to export as PACT"),
});

/**
 * GET /api/orgs/[orgId]/supplier-portal/pact-export?requestId=...
 * Export supplier Scope 3 request data in PACT/PCF Pathfinder format.
 *
 * PACT is a standardized JSON format for sharing product carbon footprints
 * and material-level emissions data between suppliers and customers.
 * See: https://www.carbon-trust.org/pact
 *
 * Authentication: API key for org admin, or invite token for supplier
 */
export async function GET(
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

    // Parse query parameters
    const searchParams = req.nextUrl.searchParams;
    const query = PactExportSchema.safeParse({
      supplierDataRequestId: searchParams.get("requestId"),
    });

    if (!query.success) {
      return apiError("VALIDATION_ERROR", "Invalid query parameters", 400, query.error.flatten());
    }

    const { supplierDataRequestId } = query.data;

    // Fetch the supplier data request with organization
    const request = await prisma.supplierDataRequest.findUnique({
      where: { id: supplierDataRequestId },
      select: {
        id: true,
        organizationId: true,
        categoryCode: true,
        supplierName: true,
        supplierEmail: true,
        notes: true,
        sentAt: true,
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!request || request.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Supplier data request not found", 404);
    }

    // Build PACT/PCF Pathfinder format response
    const pactData = {
      // PACT envelope
      specVersion: "3.0.0",
      documentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Company details (buyer/requesting org)
      company: {
        name: request.organization.name,
        id: request.organizationId,
        website: process.env.NEXT_PUBLIC_APP_URL,
      },

      // Supplier information
      supplier: {
        name: request.supplierName || "Unknown Supplier",
        email: request.supplierEmail,
      },

      // Data request context
      request: {
        id: request.id,
        category: mapCategoryToPact(request.categoryCode),
        notes: request.notes,
        requestedAt: request.sentAt.toISOString(),
      },

      // Scope 3 guidance template
      scope3Guidance: {
        description: "Scope 3 emissions data requested for corporate responsibility reporting",
        allowedCategories: [
          "purchased-goods-services",
          "capital-goods",
          "fuel-energy-not-included-in-scope",
          "upstream-transportation-distribution",
          "waste-generated-operations",
          "business-travel",
          "employee-commuting",
          "upstream-leased-assets",
          "downstream-transportation-distribution",
          "processing-sold-products",
          "use-sold-products",
          "end-of-life-sold-products",
          "downstream-leased-assets",
          "franchises",
          "investments",
        ],
        methodology: "GHG Protocol Scope 3 Standard",
        dataFormatPreferences: {
          preferred: "activity-based",
          acceptable: ["spend-based", "hybrid"],
        },
      },

      // Expected response schema
      expectedData: {
        emissionFactor: {
          value: "Number",
          unit: "kg CO2e per unit (e.g., kg CO2e/kg product, kg CO2e/£ spend)",
        },
        productUnit: {
          value: "String",
          examples: ["kg", "liters", "units", "GJ"],
        },
        dataQuality: {
          value: "0-100 score",
          description: "Our data quality scoring system",
        },
        metadata: {
          source: "Original data source (primary data, industry average, etc.)",
          methodology: "How the factor was calculated",
          coverage: "Geographic/temporal coverage",
        },
      },

      // Submission instructions
      submissionInstructions: {
        endpoint: `${process.env.NEXT_PUBLIC_APP_URL}/api/orgs/${orgId}/supplier-portal/pact-import`,
        format: "application/json",
        authentication: "Invite token or Supplier API key",
        deadline: calculateDeadline(),
      },
    };

    return NextResponse.json(pactData);
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Map CarbonSite emission categories to PACT Scope 3 categories.
 */
function mapCategoryToPact(categoryCode: string): string {
  const mapping: Record<string, string> = {
    "s3-purchased-goods": "purchased-goods-services",
    "s3-capital-goods": "capital-goods",
    "s3-fuel-energy": "fuel-energy-not-included-in-scope",
    "s3-upstream-transport": "upstream-transportation-distribution",
    "s3-waste": "waste-generated-operations",
    "s3-business-travel": "business-travel",
    "s3-commuting": "employee-commuting",
    "s3-upstream-leased": "upstream-leased-assets",
    "s3-downstream-transport": "downstream-transportation-distribution",
    "s3-processing": "processing-sold-products",
    "s3-use-sold": "use-sold-products",
    "s3-end-of-life": "end-of-life-sold-products",
    "s3-downstream-leased": "downstream-leased-assets",
    "s3-franchises": "franchises",
    "s3-investments": "investments",
  };

  return mapping[categoryCode] || "purchased-goods-services";
}

/**
 * Calculate response deadline (30 days from now).
 */
function calculateDeadline(): string {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 30);
  return deadline.toISOString();
}
