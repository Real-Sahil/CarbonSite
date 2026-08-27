import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enqueueAirbyteSyncCompletion } from '@/lib/jobs/queues';

const AirbyteSyncCompletionEventSchema = z.object({
  type: z.enum(['connection.sync_success', 'connection.sync_failed', 'connection.sync_partial_success']),
  connectionId: z.string(),
  syncRunId: z.string(),
  recordsEmitted: z.number().optional(),
  errorMessage: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const event = AirbyteSyncCompletionEventSchema.parse(body);

    console.log('[Airbyte Webhook] Received sync completion event', {
      syncRunId: event.syncRunId,
      connectionId: event.connectionId,
      type: event.type,
      recordsEmitted: event.recordsEmitted,
    });

    const { type, connectionId, syncRunId, recordsEmitted } = event;

    // Only process successful syncs
    if (type === 'connection.sync_success' || type === 'connection.sync_partial_success') {
      // Enqueue Airbyte sync processing job
      await enqueueAirbyteSyncCompletion({
        connectionId,
        syncRunId,
        recordsEmitted,
      });

      return NextResponse.json(
        {
          received: true,
          syncRunId,
          jobQueued: true,
        },
        { status: 202 }
      );
    }

    if (type === 'connection.sync_failed') {
      console.warn(`[Airbyte Webhook] Sync failed for connection ${connectionId}`, {
        syncRunId,
        errorMessage: event.errorMessage,
      });
      // Acknowledge failure without processing
      return NextResponse.json(
        {
          received: true,
          syncRunId,
          status: 'failed',
        },
        { status: 200 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('[Airbyte Webhook] Invalid payload', {
        errors: error.errors,
      });
      return NextResponse.json(
        {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid Airbyte webhook payload',
        },
        { status: 400 }
      );
    }

    console.error('[Airbyte Webhook] Processing failed', error);
    return NextResponse.json(
      {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook',
      },
      { status: 500 }
    );
  }
}
