import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getObject } from "@/lib/storage";
import { z } from "zod";

const QuerySchema = z.object({
  doc: z.coerce.number().int().min(0).max(5),
});

const documentMap = [
  "01-executive-summary",
  "02-sustainability-manager",
  "03-finance-lead",
  "04-field-worker",
  "05-technical-integration",
  "06-compliance-guide",
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Authorization: admin or editor only
    await requireOrgMember(orgId, "admin", "editor");

    // Parse and validate query parameter
    const { searchParams } = new URL(req.url);
    const query = QuerySchema.parse({
      doc: searchParams.get("doc"),
    });

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

    // Get the most recent kit generation to find PDF storage keys
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
          message: "No pilot kit has been generated for this organization",
        },
        { status: 404 }
      );
    }

    // Extract the date from the most recent generation
    const generatedDate = recentGeneration.createdAt.toISOString().split("T")[0];
    const documentName = documentMap[query.doc];
    const storageKey = `org/${orgId}/pilot-kit/${documentName}-${generatedDate}.pdf`;

    // Retrieve PDF from R2
    const pdfBuffer = await getObject(storageKey);

    if (!pdfBuffer) {
      return NextResponse.json(
        {
          code: "PDF_NOT_FOUND",
          message: "PDF file not found in storage",
        },
        { status: 404 }
      );
    }

    // Return PDF with proper headers
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${documentName}-${generatedDate}.pdf"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: error.message },
        { status: error.status }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          code: "INVALID_PARAMETER",
          message: "Invalid document index",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error("[PILOT-KIT-DOWNLOAD] Retrieval error:", error);
    return NextResponse.json(
      {
        code: "DOWNLOAD_ERROR",
        message: "Failed to download pilot kit document",
      },
      { status: 500 }
    );
  }
}
