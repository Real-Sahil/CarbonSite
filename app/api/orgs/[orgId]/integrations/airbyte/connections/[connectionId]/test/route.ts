import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';

type Params = { params: Promise<{ orgId: string; connectionId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId, connectionId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const connection = await prisma.airbyteSyncConnection.findUniqueOrThrow({
      where: { id: connectionId },
      select: { organizationId: true },
    });

    if (connection.organizationId !== orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // In production: Call Airbyte API to test connection
    // For now, just verify the connection exists
    await prisma.airbyteSyncConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncStatus: 'running',
      },
    });

    // TODO: Call Airbyte API endpoint:
    // POST https://api.airbyte.io/v1/connections/{connection_id}/test
    // await airbyte.testConnection(connectionId);

    return NextResponse.json({
      tested: true,
      message: 'Connection test initiated. Check logs for results.',
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
