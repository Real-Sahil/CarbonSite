export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/db/audit";
import { handleRouteError, apiError } from "@/lib/validation/api";
import { updateExternalCredentialSchema } from "@/lib/validation/org";
import { encryptCredential } from "@/lib/integrations/encryption";

type RouteContext = { params: Promise<{ orgId: string; credentialId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, credentialId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const cred = await prisma.externalApiCredential.findUnique({ where: { id: credentialId } });
    if (!cred || cred.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Credential not found.", 404);
    }

    const body = updateExternalCredentialSchema.parse(await req.json());

    const updated = await prisma.externalApiCredential.update({
      where: { id: credentialId },
      data: {
        ...(body.label !== undefined && { label: body.label ?? null }),
        ...(body.apiKey && { encryptedKey: encryptCredential(body.apiKey) }),
        ...(body.scopes && { scopes: body.scopes }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "external_credential.updated",
      resourceType: "ExternalApiCredential",
      resourceId: credentialId,
      metadata: { provider: cred.provider, updatedFields: Object.keys(body) },
    });

    const { encryptedKey: _k, ...safe } = updated;
    return NextResponse.json(safe);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { orgId, credentialId } = await params;
    const { session } = await requireOrgMember(orgId, "admin", "sustainability_director");

    const cred = await prisma.externalApiCredential.findUnique({ where: { id: credentialId } });
    if (!cred || cred.organizationId !== orgId) {
      return apiError("NOT_FOUND", "Credential not found.", 404);
    }

    await prisma.externalApiCredential.delete({ where: { id: credentialId } });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: "external_credential.deleted",
      resourceType: "ExternalApiCredential",
      resourceId: credentialId,
      metadata: { provider: cred.provider },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleRouteError(err);
  }
}
