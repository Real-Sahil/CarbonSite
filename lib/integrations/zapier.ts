import { prisma } from '@/lib/db';
import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(process.env.ZAPIER_ENCRYPTION_KEY || 'default-dev-key-32-chars-needed!!', 'utf-8').slice(0, 32);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(encryptedSecret: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedSecret.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(process.env.ZAPIER_ENCRYPTION_KEY || 'default-dev-key-32-chars-needed!!', 'utf-8').slice(0, 32);

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function registerZapierIntegration(
  organizationId: string,
  zapierCustomId: string,
  webhookSecret: string,
  triggerEventTypes: string[] = [],
  actionTypes: string[] = [],
) {
  const encryptedSecret = encryptSecret(webhookSecret);

  return prisma.zapierIntegration.upsert({
    where: { organizationId },
    update: {
      zapierCustomId,
      encryptedSecret,
      triggerEventTypes,
      actionTypes,
      installCount: { increment: 1 },
      lastWebhookAt: new Date(),
    },
    create: {
      organizationId,
      zapierCustomId,
      encryptedSecret,
      triggerEventTypes,
      actionTypes,
      installCount: 1,
    },
  });
}

export async function getZapierIntegration(organizationId: string) {
  return prisma.zapierIntegration.findUnique({
    where: { organizationId },
  });
}

export function verifyZapierWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const computed = hmac.digest('base64');
  return computed === signature;
}

export async function logZapierWebhookActivity(
  organizationId: string,
  event: string,
  success: boolean,
  errorMessage?: string,
) {
  const integration = await getZapierIntegration(organizationId);
  if (!integration) return;

  await prisma.zapierIntegration.update({
    where: { organizationId },
    data: {
      lastWebhookAt: new Date(),
      ...(success === false && {
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage,
      }),
    },
  });
}

export const ZAPIER_TRIGGERS = {
  ACTIVITY_RECORD_CREATED: 'activity_record.created',
  ACTIVITY_RECORD_UPDATED: 'activity_record.updated',
  REPORT_PUBLISHED: 'report.published',
  SUPPLIER_SUBMISSION: 'supplier_submission.received',
  FIELD_SUBMISSION: 'field_submission.received',
  CALCULATION_RUN_COMPLETED: 'calculation_run.completed',
  SNAPSHOT_PUBLISHED: 'snapshot.published',
} as const;

export const ZAPIER_ACTIONS = {
  CREATE_ACTIVITY_RECORD: 'create_activity_record',
  UPDATE_ACTIVITY_RECORD: 'update_activity_record',
  CREATE_IMPORT: 'create_import',
  APPROVE_SUPPLIER_SUBMISSION: 'approve_supplier_submission',
  REJECT_SUPPLIER_SUBMISSION: 'reject_supplier_submission',
} as const;

export async function emitZapierEvent(
  organizationId: string,
  eventType: string,
  payload: Record<string, any>,
) {
  const integration = await getZapierIntegration(organizationId);
  if (!integration || !integration.enabled || !integration.triggerEventTypes.includes(eventType)) {
    return;
  }

  try {
    await logZapierWebhookActivity(organizationId, eventType, true);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logZapierWebhookActivity(organizationId, eventType, false, errorMessage);
  }
}

export async function handleZapierAction(
  organizationId: string,
  actionType: string,
  payload: Record<string, any>,
) {
  const integration = await getZapierIntegration(organizationId);
  if (!integration || !integration.enabled || !integration.actionTypes.includes(actionType)) {
    throw new Error('Action not enabled for this integration');
  }

  switch (actionType) {
    case ZAPIER_ACTIONS.CREATE_ACTIVITY_RECORD:
      break;
    case ZAPIER_ACTIONS.APPROVE_SUPPLIER_SUBMISSION:
      break;
    default:
      throw new Error(`Unknown action type: ${actionType}`);
  }
}

export function validateZapierConfig(): void {
  if (!process.env.ZAPIER_APP_ID) {
    throw new Error('ZAPIER_APP_ID not configured');
  }
  if (!process.env.ZAPIER_ENCRYPTION_KEY) {
    throw new Error('ZAPIER_ENCRYPTION_KEY not configured');
  }
}

export function extractOrgIdFromBundle(bundle: { authData?: { orgId?: string } }): string {
  const orgId = bundle?.authData?.orgId;
  if (!orgId) {
    throw new Error('Organization ID not found in bundle');
  }
  return orgId;
}

export function validateZapierSignature(signature: string, payload: string, secret: string): boolean {
  return verifyZapierWebhookSignature(payload, signature, secret);
}
