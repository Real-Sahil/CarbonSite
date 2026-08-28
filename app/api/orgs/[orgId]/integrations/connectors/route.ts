import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Require admin role for connector management
    await requireOrgMember(orgId, 'admin', 'editor');

    // TODO: Implement Airbyte integration after AirbyteSyncConnection model added to schema (Phase 2)
    return apiError('NOT_IMPLEMENTED', 'Airbyte connector management coming in Phase 2. Integration framework not yet available.', 501);

    /* DISABLED: Waiting for AirbyteSyncConnection model in schema
    // Fetch all Airbyte sync connections for this org
    const connections = await prisma.airbyteSyncConnection.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        sourceSystem: true,
        enabled: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        syncFrequency: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      connections,
      total: connections.length
    });
    */
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    // Require admin role to create connections
    await requireOrgMember(orgId, 'admin');

    // TODO: Implement Airbyte integration after AirbyteSyncConnection model added to schema (Phase 2)
    return apiError('NOT_IMPLEMENTED', 'Airbyte connector management coming in Phase 2. Integration framework not yet available.', 501);

    /* DISABLED: Waiting for AirbyteSyncConnection model in schema
    const body = await req.json();
    const { sourceSystem, airbytConnectionId, airbytSourceId, airbytDestinationId, config, syncFrequency } = body;

    if (!sourceSystem || !airbytConnectionId) {
      return apiError(
        'INVALID_REQUEST',
        'sourceSystem and airbytConnectionId are required',
        400
      );
    }

    // Check if connection already exists
    const existing = await prisma.airbyteSyncConnection.findFirst({
      where: {
        organizationId: orgId,
        sourceSystem
      }
    });

    if (existing) {
      return apiError(
        'ALREADY_EXISTS',
        `Connection for ${sourceSystem} already exists. Update or delete it first.`,
        409
      );
    }

    // Create new connection
    const connection = await prisma.airbyteSyncConnection.create({
      data: {
        organizationId: orgId,
        sourceSystem,
        airbytConnectionId,
        airbytSourceId,
        airbytDestinationId,
        config: config || {},
        syncFrequency: syncFrequency || 'daily',
        enabled: true
      }
    });

    return NextResponse.json({ connection }, { status: 201 });
    */
  } catch (error) {
    return handleRouteError(error);
  }
}
