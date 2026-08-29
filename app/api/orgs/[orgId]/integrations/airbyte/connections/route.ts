import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember, ROLE_GROUPS } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';

const CreateConnectionSchema = z.object({
  sourceSystem: z.enum(['salesforce', 'sap', 'aws_iot', 'quickbooks', 'xero']),
  config: z.record(z.unknown()),
  syncFrequency: z.enum(['daily', 'weekly', 'manual']).default('daily')
});

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);

    const connections = await prisma.airbyteSyncConnection.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        sourceSystem: true,
        enabled: true,
        syncFrequency: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ connections });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, ...ROLE_GROUPS.editor);

    const body = await req.json();
    const { sourceSystem, config, syncFrequency } = CreateConnectionSchema.parse(body);

    const connection = await prisma.airbyteSyncConnection.create({
      data: {
        organizationId: orgId,
        sourceSystem,
        config,
        syncFrequency,
        enabled: true
      },
      select: {
        id: true,
        sourceSystem: true,
        enabled: true,
        syncFrequency: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        createdAt: true
      }
    });

    securityLogger.info(`Airbyte connection created: ${connection.id}`, {
      orgId,
      sourceSystem,
      initiatedBy: req.headers.get('x-user-id') || 'unknown'
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
