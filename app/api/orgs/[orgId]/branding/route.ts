export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { rateLimitRequest, rateLimitKey } from "@/lib/security/rate-limit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { upsertBrandingSchema } from "@/lib/validation/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(
      orgId,
      "admin", "sustainability_director", "sustainability_manager",
      "editor", "viewer", "auditor", "client_viewer",
    );

    const branding = await prisma.tenantBranding.findUnique({
      where: { organizationId: orgId },
    });

    return NextResponse.json(branding ?? null);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin");
    const limited = await rateLimitRequest(req, {
      key: rateLimitKey(orgId, "branding-upsert", session.user.id),
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = upsertBrandingSchema.parse(await req.json());

    // Ensure subdomain is not claimed by another org
    const conflict = await prisma.tenantBranding.findFirst({
      where: { subdomain: body.subdomain, organizationId: { not: orgId } },
    });
    if (conflict) {
      return apiError("SUBDOMAIN_TAKEN", "That subdomain is already in use.", 409);
    }

    if (body.customDomain) {
      const domainConflict = await prisma.tenantBranding.findFirst({
        where: { customDomain: body.customDomain, organizationId: { not: orgId } },
      });
      if (domainConflict) {
        return apiError("DOMAIN_TAKEN", "That custom domain is already in use.", 409);
      }
    }

    const branding = await prisma.tenantBranding.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        subdomain: body.subdomain,
        customDomain: body.customDomain ?? null,
        primaryHex: body.primaryHex,
        accentHex: body.accentHex,
        emailFromName: body.emailFromName ?? null,
        emailFromDomain: body.emailFromDomain ?? null,
        fontFamily: body.fontFamily,
        ...(body.reportHeaderLogoKey !== undefined
          ? { reportHeaderLogoKey: body.reportHeaderLogoKey }
          : {}),
      },
      update: {
        subdomain: body.subdomain,
        customDomain: body.customDomain ?? null,
        primaryHex: body.primaryHex,
        accentHex: body.accentHex,
        emailFromName: body.emailFromName ?? null,
        emailFromDomain: body.emailFromDomain ?? null,
        fontFamily: body.fontFamily,
        ...(body.reportHeaderLogoKey !== undefined
          ? { reportHeaderLogoKey: body.reportHeaderLogoKey }
          : {}),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "branding.upserted",
      resourceType: "tenant_branding",
      resourceId: branding.id,
      metadata: { subdomain: branding.subdomain },
    });

    return NextResponse.json(branding);
  } catch (err) {
    return handleRouteError(err);
  }
}
