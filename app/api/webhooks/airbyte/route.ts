import { NextRequest, NextResponse } from 'next/server';
import { enqueueAirbyteSyncCompletion } from '@/lib/jobs/queues';

export async function POST(req: NextRequest) {
  try {
    const event = await req.json();

    // Airbyte webhook events:
    // - connection.sync_success: Sync completed successfully
    // - connection.sync_failed: Sync failed
    // - connection.sync_partial_success: Partial success

    if (!event.type || !event.connectionId) {
      return NextResponse.json(
        { error: 'Missing event type or connectionId' },
        { status: 400 }
      );
    }

    const { type, connectionId, syncRunId, recordsEmitted } = event;

    // Only process successful syncs
    if (type === 'connection.sync_success' || type === 'connection.sync_partial_success') {
      // Enqueue Airbyte sync processing job
      await enqueueAirbyteSyncCompletion({
        connectionId,
        syncRunId,
        recordsEmitted
      });

      return NextResponse.json({
        success: true,
        message: 'Airbyte sync event processed',
        jobQueued: true
      });
    }

    if (type === 'connection.sync_failed') {
      console.error(`Airbyte sync failed for connection ${connectionId}:`, event);
      // Could optionally enqueue an error notification job here
      return NextResponse.json({
        success: true,
        message: 'Airbyte sync failure logged'
      });
    }

    // Acknowledge other event types without processing
    return NextResponse.json({
      success: true,
      message: 'Event acknowledged'
    });
  } catch (error) {
    console.error('Airbyte webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
