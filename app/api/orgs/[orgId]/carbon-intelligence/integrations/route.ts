export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { createExternalCredentialSchema } from "@/lib/validation/org";
import { encryptCredential } from "@/lib/integrations/encryption";

type RouteContext = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, "admin", "sustainability_director");

    const creds = await prisma.externalApiCredential.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        provider: true,
        label: true,
        scopes: true,
        isActive: true,
        lastValidatedAt: true,
        createdAt: true,
        updatedAt: true,
        // Never return encryptedKey
      },
      orderBy: { provider: "asc" },
    });

    return NextResponse.json(creds);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const body = createExternalCredentialSchema.parse(await req.json());

    // Check for existing credential for this provider
    const existing = await prisma.externalApiCredential.findUnique({
      where: { organizationId_provider: { organizationId: orgId, provider: body.provider } },
    });
    if (existing) {
      return apiError("CONFLICT", `Credential for provider '${body.provider}' already exists. Use PATCH to update.`, 409);
    }

    const encryptedKey = encryptCredential(body.apiKey);

    const cred = await prisma.externalApiCredential.create({
      data: {
        organizationId: orgId,
        provider: body.provider,
        label: body.label ?? null,
        encryptedKey,
        scopes: body.scopes,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "external_credential.created",
      resourceType: "ExternalApiCredential",
      resourceId: cred.id,
      metadata: { provider: body.provider, label: body.label },
    });

    const { encryptedKey: _k, ...safe } = cred;
    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
