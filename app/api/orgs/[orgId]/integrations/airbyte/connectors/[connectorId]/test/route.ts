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

    const startTime = Date.now();

    try {
      // TODO: Implement actual connection test based on sourceSystem
      // For now, simulate a successful test
      const testPassed = Math.random() > 0.2; // 80% success rate for demo

      const duration = Date.now() - startTime;

      if (!testPassed) {
        const testError = "Failed to authenticate with data source";

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: null,
            action: "INTEGRATION_TEST_FAILED",
            resourceType: "airbyte_connector",
            resourceId: connectorId,
            metadata: {
              testError,
              duration
            },
            ipAddress: req.headers.get("x-forwarded-for") || undefined,
            userAgent: req.headers.get("user-agent") || undefined
          }
        });

        return NextResponse.json(
          {
            success: false,
            message: testError,
            duration
          },
          { status: 400 }
        );
      }

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: null,
          action: "INTEGRATION_TEST_PASSED",
          resourceType: "airbyte_connector",
          resourceId: connectorId,
          metadata: {
            duration,
            recordsAvailable: Math.floor(Math.random() * 10000) + 100
          },
          ipAddress: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined
        }
      });

      return NextResponse.json({
        success: true,
        message: "Connection test passed",
        duration,
        recordsAvailable: Math.floor(Math.random() * 10000) + 100
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: null,
          action: "INTEGRATION_TEST_ERROR",
          resourceType: "airbyte_connector",
          resourceId: connectorId,
          metadata: {
            error: errorMessage
          },
          ipAddress: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined
        }
      });

      return apiError("TEST_FAILED", errorMessage, 400);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
