import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { presignDownload } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Authorization: admin or editor only
    await requireOrgMember(orgId, "admin", "editor");

    // Query audit log for most recent kit generation
    const recentGeneration = await prisma.auditLog.findFirst({
      where: {
        organizationId: orgId,
        action: "pilot.kit_generated",
      },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        metadata: true,
      },
    });

    if (!recentGeneration) {
      return NextResponse.json(
        {
          code: "NO_KIT_GENERATED",
          message: "No pilot kit has been generated yet",
          data: null,
        },
        { status: 404 }
      );
    }

    // Extract timestamp from metadata
    const metadata = typeof recentGeneration.metadata === "object" && recentGeneration.metadata !== null
      ? recentGeneration.metadata
      : {};
    const timestamp = (metadata as any).timestamp || recentGeneration.createdAt.toISOString().split("T")[0];

    // Document definitions
    const documents = [
      { name: "Executive Summary", audience: "Executive Stakeholders", key: `org/${orgId}/pilot-kit/01-executive-summary-${timestamp}.pdf` },
      { name: "Sustainability Manager Guide", audience: "Sustainability Lead", key: `org/${orgId}/pilot-kit/02-sustainability-manager-${timestamp}.pdf` },
      { name: "Finance Lead Guide", audience: "Finance Lead", key: `org/${orgId}/pilot-kit/03-finance-lead-${timestamp}.pdf` },
      { name: "Field Worker Guide", audience: "Field Workers", key: `org/${orgId}/pilot-kit/04-field-worker-${timestamp}.pdf` },
      { name: "Technical Integration Guide", audience: "IT Administrator", key: `org/${orgId}/pilot-kit/05-technical-integration-${timestamp}.pdf` },
      { name: "Compliance Guide", audience: "Compliance & Audit", key: `org/${orgId}/pilot-kit/06-compliance-guide-${timestamp}.pdf` },
    ];

    // Generate presigned URLs for all documents
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const downloadUrl = await presignDownload(doc.key);
          return {
            name: doc.name,
            audience: doc.audience,
            storageKey: doc.key,
            downloadUrl,
          };
        } catch (err) {
          console.error(`[PILOT-KIT] Failed to presign download for ${doc.key}:`, err);
          return {
            name: doc.name,
            audience: doc.audience,
            storageKey: doc.key,
            downloadUrl: null,
            error: "Failed to generate download link",
          };
        }
      })
    );

    return NextResponse.json(
      {
        code: "OK",
        data: {
          generatedAt: recentGeneration.createdAt.toISOString(),
          documents: documentsWithUrls,
          context: (metadata as any).context || null,
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

    console.error("[PILOT-KIT] Kit documents retrieval error:", error);
    return NextResponse.json(
      {
        code: "RETRIEVAL_ERROR",
        message: "Failed to retrieve pilot kit documents",
      },
      { status: 500 }
    );
  }
}
