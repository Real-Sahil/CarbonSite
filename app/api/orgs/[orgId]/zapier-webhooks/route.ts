import { NextRequest, NextResponse } from 'next/server';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { getZapierIntegration, handleZapierAction, logZapierWebhookActivity, decryptSecret, verifyZapierWebhookSignature } from '@/lib/integrations/zapier';

const ZapierWebhookSchema = z.object({
  eventType: z.string(),
  payload: z.record(z.any()),
});

/**
 * POST /api/orgs/[orgId]/zapier-webhooks
 * Receive and process Zapier webhook events
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;

    const integration = await getZapierIntegration(orgId);
    if (!integration) {
      return NextResponse.json(
        { code: 'INTEGRATION_NOT_FOUND', message: 'Zapier integration not configured' },
        { status: 404 },
      );
    }

    const rawBody = await req.text();
    const signature = req.headers.get('X-Zapier-Signature');

    if (!signature) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Missing signature' },
        { status: 401 },
      );
    }

    const secret = decryptSecret(integration.encryptedSecret);
    if (!verifyZapierWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' },
        { status: 401 },
      );
    }

    const body = JSON.parse(rawBody);
    const { eventType, payload } = ZapierWebhookSchema.parse(body);

    await handleZapierAction(orgId, eventType, payload);
    await logZapierWebhookActivity(orgId, eventType, true);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { orgId } = await params;
    if (orgId) {
      await logZapierWebhookActivity(orgId, 'unknown', false, errorMessage).catch(() => {});
    }
    return handleRouteError(error);
  }
}
