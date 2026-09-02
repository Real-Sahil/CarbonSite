import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";

interface Params {
  orgId: string;
  connectorId: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<Params> }) {
  try {
    const { orgId, connectorId } = await params;
    await requireOrgMember(orgId, "admin");

    const connector = await prisma.airbiteConnector.findUnique({
      where: { id: connectorId }
    });

    if (!connector || connector.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Connector not found", 404);
    }

    return apiError(
      "NOT_IMPLEMENTED",
      "Connector testing requires the Airbyte Cloud API to be configured. " +
        "Set AIRBYTE_API_KEY and AIRBYTE_WORKSPACE_ID environment variables, " +
        "then wire this endpoint to POST /v1/connections/test in the Airbyte API.",
      501
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
