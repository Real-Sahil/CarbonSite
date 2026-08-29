import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { securityLogger } from '@/lib/logger';
import { enqueueAirbyteSyncCompletion, enqueueNotification } from '@/lib/jobs/queues';

const AirbyteSyncCompletionEventSchema = z.object({
  type: z.enum(['connection.sync_success', 'connection.sync_failed', 'connection.sync_partial_success']),
  connectionId: z.string(),
  syncRunId: z.string().optional(),
  recordsEmitted: z.number().optional(),
  bytesSynced: z.number().optional(),
  errorMessage: z.string().optional(),
});

type AirbyteSyncEvent = z.infer<typeof AirbyteSyncCompletionEventSchema>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const event = AirbyteSyncCompletionEventSchema.parse(body);

    securityLogger.info('Airbyte webhook received', {
      type: event.type,
      connectionId: event.connectionId,
      syncRunId: event.syncRunId,
      recordsEmitted: event.recordsEmitted,
    });

    const { type, connectionId, syncRunId, recordsEmitted } = event;

    // Find the connection in our database
    const connection = await prisma.airbyteSyncConnection.findUnique({
      where: { airbytConnectionId: connectionId },
      select: {
        id: true,
        organizationId: true,
        sourceSystem: true,
        enabled: true,
      },
    });

    if (!connection) {
      securityLogger.warn('Airbyte webhook for unknown connection', {
        connectionId,
        type,
      });
      return NextResponse.json(
        { error: 'Connection not found', code: 'UNKNOWN_CONNECTION' },
        { status: 404 }
      );
    }

    if (!connection.enabled) {
      securityLogger.warn('Airbyte webhook received for disabled connection', {
        connectionId: connection.id,
        organizationId: connection.organizationId,
      });
      return NextResponse.json(
        { error: 'Connection is disabled', code: 'DISABLED_CONNECTION' },
        { status: 400 }
      );
    }

    // Handle different webhook types
    if (type === 'connection.sync_success' || type === 'connection.sync_partial_success') {
      try {
        // Enqueue data processing worker
        await enqueueAirbyteSyncCompletion({
          connectionId: connection.id,
          syncRunId,
          recordsEmitted,
        });

        // Update last sync status
        await prisma.airbyteSyncConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: type === 'connection.sync_success' ? 'succeeded' : 'partial_success',
          },
        });

        securityLogger.info('Airbyte sync queued for processing', {
          connectionId: connection.id,
          organizationId: connection.organizationId,
          recordsEmitted,
          type,
        });

        return NextResponse.json(
          {
            received: true,
            syncRunId,
            jobQueued: true,
            message: 'Sync data queued for processing',
          },
          { status: 202 }
        );
      } catch (queueError) {
        securityLogger.error('Failed to enqueue airbyte-sync job', {
          connectionId: connection.id,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        });
        throw queueError;
      }
    }

    if (type === 'connection.sync_failed') {
      try {
        // Update connection with failure info
        await prisma.airbyteSyncConnection.update({
          where: { id: connection.id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: 'failed',
          },
        });

        securityLogger.error('Airbyte sync failed', {
          connectionId: connection.id,
          organizationId: connection.organizationId,
          syncRunId,
          errorMessage: event.errorMessage,
        });

        // Optionally enqueue a notification to alert admins
        try {
          // Note: notification type must match NotificationJobData union type
          // For now, using 'import_failed' as it's a similar failure notification
          // In production, extend NotificationJobData to include 'airbyte_sync_failed'
          await enqueueNotification({
            type: 'import_failed',
            recipientUserId: 'admin',
            orgId: connection.organizationId,
            resourceId: connection.id,
            metadata: { errorMessage: event.errorMessage },
          });
        } catch (notifyError) {
          securityLogger.warn('Failed to enqueue notification for sync failure', {
            error: notifyError instanceof Error ? notifyError.message : String(notifyError),
          });
          // Don't throw; notification failure shouldn't block webhook response
        }

        return NextResponse.json(
          {
            received: true,
            syncRunId,
            status: 'failed',
            message: 'Sync failed acknowledgement recorded',
          },
          { status: 200 }
        );
      } catch (updateError) {
        securityLogger.error('Failed to update connection on sync failure', {
          connectionId: connection.id,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
        throw updateError;
      }
    }

    securityLogger.warn('Unknown Airbyte webhook type', {
      type,
      connectionId,
    });
    return NextResponse.json(
      { error: 'Unknown webhook type', code: 'UNKNOWN_TYPE' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Airbyte webhook validation failed', {
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return NextResponse.json(
        {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid Airbyte webhook payload',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return handleRouteError(error);
  }
}
