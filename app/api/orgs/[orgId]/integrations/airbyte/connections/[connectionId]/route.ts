import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';

const UpdateConnectionSchema = z.object({
  config: z.record(z.unknown()).optional(),
  syncFrequency: z.enum(['daily', 'weekly', 'manual']).optional(),
  enabled: z.boolean().optional()
});

type Params = { params: Promise<{ orgId: string; connectionId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const connection = await prisma.airbyteSyncConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: {
        id: true,
        organizationId: true,
        sourceSystem: true,
        enabled: true,
        syncFrequency: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (connection.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const existing = await prisma.airbyteSyncConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: { organizationId: true }
    });

    if (existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { config, syncFrequency, enabled } = UpdateConnectionSchema.parse(body);

    const connection = await prisma.airbyteSyncConnection.update({
      where: { id: connectionId },
      data: {
        ...(config && { config }),
        ...(syncFrequency && { syncFrequency }),
        ...(enabled !== undefined && { enabled })
      },
      select: {
        id: true,
        sourceSystem: true,
        enabled: true,
        syncFrequency: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        updatedAt: true
      }
    });

    securityLogger.info(`Airbyte connection updated: ${connectionId}`, {
      orgId,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ connection });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.admins);

    const existing = await prisma.airbyteSyncConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: { organizationId: true }
    });

    if (existing.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.airbyteSyncConnection.delete({
      where: { id: connectionId }
    });

    securityLogger.info(`Airbyte connection deleted: ${connectionId}`, {
      orgId,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
