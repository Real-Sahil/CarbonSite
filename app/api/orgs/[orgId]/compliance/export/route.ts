import { NextRequest, NextResponse } from "next/server";
import { requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { generateComplianceEvidence, createCompliancePDF } from "@/lib/compliance/evidence-generator";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { withApiVersion, checkDeprecationWarning } from "@/lib/api/versioned-handler";
import { z } from "zod";

const querySchema = z.object({
  reportId: z.string().min(1),
  frameworks: z.string().default("ghg-protocol,csrd,sbti"),
  format: z.enum(["json", "pdf"]).default("pdf"),
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    const { version } = await withApiVersion(_req);

    const deprecationWarning = checkDeprecationWarning(version);
    if (deprecationWarning) {
      console.warn(`[API v${version}] ${deprecationWarning}`);
    }

    await requireOrgMember(orgId, ...ROLE_GROUPS.sustainability);

    const query = querySchema.safeParse({
      reportId: _req.nextUrl.searchParams.get("reportId") ?? undefined,
      frameworks: _req.nextUrl.searchParams.get("frameworks") ?? undefined,
      format: _req.nextUrl.searchParams.get("format") ?? undefined,
    });

    if (!query.success) {
      return apiError("INVALID_QUERY", "Invalid query parameters", 400, query.error.flatten());
    }

    const { reportId, frameworks, format } = query.data;
    const frameworkList = frameworks.split(",") as Array<
      "csrd" | "sbti" | "cdp" | "ghg-protocol" | "iso-14064"
    >;

    const evidence = await generateComplianceEvidence(orgId, reportId, {
      frameworks: frameworkList,
      includeCalculations: true,
      includeAuditTrail: true,
    });

    if (format === "json") {
      return NextResponse.json(evidence, {
        headers: {
          "API-Version": version,
          "Content-Disposition": `attachment; filename="compliance-evidence-${reportId}.json"`,
        },
      });
    }

    const pdfBytes = await createCompliancePDF(evidence);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="compliance-evidence-${reportId}.pdf"`,
        "API-Version": version,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
