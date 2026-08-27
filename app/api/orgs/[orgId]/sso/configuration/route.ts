export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { apiError, handleRouteError } from "@/lib/validation/api";
import { z } from "zod";

type Params = { params: Promise<{ orgId: string }> };

const ssoConfigSchema = z.object({
  provider: z.enum(["okta", "azure_ad", "google_workspace", "generic_oidc", "saml"]),
  enabled: z.boolean().optional(),
  metadataUrl: z.string().url().optional(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  idpEntityId: z.string().optional(),
  ssoUrl: z.string().url().optional(),
  certificateX509: z.string().optional(),
  autoCreateUsers: z.boolean().default(false),
  autoAssignRole: z.enum(["viewer", "editor", "reviewer", "auditor", "admin"]).optional(),
  requireMfa: z.boolean().default(false),
  syncAttributes: z.boolean().default(true),
});

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const config = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return NextResponse.json({
        id: null,
        organizationId: orgId,
        enabled: false,
        provider: null,
        clientId: "",
        autoCreateUsers: false,
        requireMfa: false,
        syncAttributes: true,
      });
    }

    return NextResponse.json({
      ...config,
      clientSecret: undefined, // Never expose secret in response
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin");

    const body = await req.json();
    const validated = ssoConfigSchema.parse(body);

    // Validate provider-specific required fields
    if (validated.provider === "okta" || validated.provider === "azure_ad" || validated.provider === "generic_oidc") {
      if (!validated.metadataUrl) {
        return apiError("INVALID_CONFIG", "metadataUrl is required for this provider", 400);
      }
    }

    if (validated.provider === "saml") {
      if (!validated.idpEntityId || !validated.ssoUrl || !validated.certificateX509) {
        return apiError("INVALID_CONFIG", "idpEntityId, ssoUrl, and certificateX509 are required for SAML", 400);
      }
    }

    const config = await prisma.ssoConfiguration.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        ...validated,
      },
      update: {
        ...validated,
      },
    });

    return NextResponse.json({
      ...config,
      clientSecret: undefined,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError("VALIDATION_ERROR", "Invalid SSO configuration", 400);
    }
    return handleRouteError(err);
  }
}
