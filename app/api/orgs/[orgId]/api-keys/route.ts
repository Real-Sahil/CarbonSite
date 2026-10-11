import { requireOrgMember } from '@/lib/auth/session';
import { mintApiKey } from '@/lib/auth/api-key';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/db/audit';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: apiKeys });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const { session } = await requireOrgMember(orgId, 'admin');

    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return apiError('INVALID_NAME', 'Name is required', 400);
    }

    const minted = mintApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name,
        prefix: minted.prefix,
        keyHash: minted.keyHash,
      },
    });

    await writeAuditLog({
      organizationId: orgId,
      actorUserId: session.user.id,
      action: 'api_key.created',
      resourceType: 'ApiKey',
      resourceId: apiKey.id,
      metadata: { name },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: apiKey.id,
          key: minted.secret,
          warning: 'Save this key securely. It will not be shown again.',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
