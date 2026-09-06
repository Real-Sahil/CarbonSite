import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateZapierConfig, verifyZapierWebhookSignature, decryptSecret, getZapierIntegration } from '@/lib/integrations/zapier';
import { prisma } from '@/lib/db';

const webhookSchema = z.object({
  trigger: z.enum(['activity_record.created', 'report.published']),
  organizationId: z.string().min(1),
  data: z.record(z.any()),
  timestamp: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    validateZapierConfig();

    const signature = req.headers.get('x-zapier-signature');
    const rawBody = await req.text();

    if (!signature) {
      return NextResponse.json(
        { code: 'INVALID_SIGNATURE', message: 'Missing signature' },
        { status: 401 },
      );
    }

    // Parse and validate body first so we know which org's own secret to
    // verify against — a single shared ZAPIER_WEBHOOK_SECRET would let any
    // org's Zapier connection forge webhooks claiming to be a different org.
    const body = JSON.parse(rawBody);
    const webhook = webhookSchema.parse(body);

    const integration = await getZapierIntegration(webhook.organizationId);
    if (!integration || !integration.enabled) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Zapier integration not configured for this organization' },
        { status: 404 },
      );
    }

    const secret = decryptSecret(integration.encryptedSecret);
    if (!verifyZapierWebhookSignature(rawBody, signature, secret)) {
      return NextResponse.json(
        { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' },
        { status: 401 },
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: webhook.organizationId },
    });

    if (!org) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        { status: 404 },
      );
    }

    // Store webhook event for processing (in production, queue this for async processing)
    // For now, log it and return success
    console.log(`Zapier webhook received: ${webhook.trigger} for org ${webhook.organizationId}`);

    return NextResponse.json({
      success: true,
      message: `Webhook for ${webhook.trigger} queued for processing`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid webhook payload', errors: err.errors },
        { status: 400 },
      );
    }

    const errorMessage = err instanceof Error ? err.message : 'Webhook processing failed';
    return NextResponse.json(
      { code: 'ERROR', message: errorMessage },
      { status: 500 },
    );
  }
}
