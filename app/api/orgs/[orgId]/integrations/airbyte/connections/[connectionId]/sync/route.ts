import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { securityLogger } from '@/lib/logger';

type Params = { params: Promise<{ orgId: string; connectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const connection = await prisma.airbyteSyncConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: { organizationId: true, sourceSystem: true },
    });

    if (connection.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mark sync as running
    await prisma.airbyteSyncConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncStatus: 'running',
      },
    });

    securityLogger.info(`Manual sync initiated for Airbyte connection`, {
      orgId,
      connectionId,
      sourceSystem: connection.sourceSystem,
      initiatedBy: req.headers.get('x-user-id') || 'unknown',
    });

    // TODO: Call Airbyte API endpoint:
    // POST https://api.airbyte.io/v1/connections/{connection_id}/sync
    // await airbyte.triggerSync(connectionId);

    return NextResponse.json({
      synced: true,
      message: 'Sync initiated. Monitor status in the connections dashboard.',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
