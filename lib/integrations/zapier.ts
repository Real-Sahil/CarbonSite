import { z } from 'zod';

const zapierConfigSchema = z.object({
  appId: z.string().min(1),
  appSecret: z.string().min(1),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export type ZapierConfig = z.infer<typeof zapierConfigSchema>;

export const zapierConfig: ZapierConfig = {
  appId: process.env.ZAPIER_APP_ID || '',
  appSecret: process.env.ZAPIER_APP_SECRET || '',
  clientId: process.env.ZAPIER_CLIENT_ID || '',
  clientSecret: process.env.ZAPIER_CLIENT_SECRET || '',
};

// Validates that Zapier credentials are configured
export function validateZapierConfig(): void {
  try {
    zapierConfigSchema.parse(zapierConfig);
  } catch (err) {
    throw new Error(
      'Zapier configuration incomplete. Set ZAPIER_APP_ID, ZAPIER_APP_SECRET, ZAPIER_CLIENT_ID, ZAPIER_CLIENT_SECRET',
    );
  }
}

// OAuth token storage schema (in-memory for this MVP, persist to DB in production)
export interface ZapierOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  organizationId: string;
}

const tokenStore = new Map<string, ZapierOAuthToken>();

export function storeOAuthToken(token: ZapierOAuthToken): void {
  tokenStore.set(token.organizationId, token);
}

export function getOAuthToken(organizationId: string): ZapierOAuthToken | null {
  return tokenStore.get(organizationId) || null;
}

export function removeOAuthToken(organizationId: string): void {
  tokenStore.delete(organizationId);
}

// Zapier resource definitions for dynamic field mapping
export const zapierResources = {
  activityRecord: {
    key: 'activity_record',
    noun: 'Activity Record',
    fields: [
      { key: 'quantity', label: 'Quantity', type: 'number', required: true },
      { key: 'unit', label: 'Unit', type: 'string', required: true },
      { key: 'category', label: 'Category', type: 'string', required: true },
      { key: 'description', label: 'Description', type: 'string', required: false },
      { key: 'facilityId', label: 'Facility ID', type: 'string', required: false },
      { key: 'date', label: 'Date', type: 'datetime', required: false },
    ],
  },

  supplier: {
    key: 'supplier',
    noun: 'Supplier',
    fields: [
      { key: 'email', label: 'Email', type: 'string', required: true },
      { key: 'name', label: 'Name', type: 'string', required: true },
      { key: 'company', label: 'Company', type: 'string', required: false },
    ],
  },

  report: {
    key: 'report',
    noun: 'Report',
    fields: [
      { key: 'type', label: 'Report Type', type: 'string', required: true },
      { key: 'period', label: 'Reporting Period', type: 'string', required: true },
      { key: 'format', label: 'Export Format', type: 'string', required: false },
    ],
  },
};

// Zapier trigger definitions
export const zapierTriggers = {
  activityRecordCreated: {
    key: 'activity_record.created',
    noun: 'Activity Record',
    display: {
      label: 'New Activity Record',
      description: 'Triggers when a new activity record is created',
      hidden: false,
    },
    operation: {
      inputFields: [],
      outputFields: Object.entries(zapierResources.activityRecord.fields).map(([, field]) => ({
        key: field.key,
        label: field.label,
        type: field.type,
      })),
      perform: async (z: any, bundle: any) => {
        // Webhook-based trigger; this perform is metadata only
        return [];
      },
    },
  },

  reportPublished: {
    key: 'report.published',
    noun: 'Report',
    display: {
      label: 'Report Published',
      description: 'Triggers when a new report is published',
      hidden: false,
    },
    operation: {
      inputFields: [],
      outputFields: [
        { key: 'reportId', label: 'Report ID', type: 'string' },
        { key: 'type', label: 'Type', type: 'string' },
        { key: 'publishedAt', label: 'Published At', type: 'datetime' },
      ],
      perform: async (z: any, bundle: any) => {
        return [];
      },
    },
  },
};

// Zapier action definitions
export const zapierActions = {
  createActivityRecord: {
    key: 'activity_record.create',
    noun: 'Activity Record',
    display: {
      label: 'Create Activity Record',
      description: 'Create a new activity record in CarbonSite',
      hidden: false,
    },
    operation: {
      inputFields: zapierResources.activityRecord.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
      })),
      outputFields: [
        { key: 'id', label: 'Record ID', type: 'string' },
        { key: 'quantity', label: 'Quantity', type: 'number' },
        { key: 'createdAt', label: 'Created At', type: 'datetime' },
      ],
      perform: async (z: any, bundle: any) => {
        // This will be called via API; actual implementation in route handler
        return [];
      },
    },
  },

  createSupplier: {
    key: 'supplier.create',
    noun: 'Supplier',
    display: {
      label: 'Create Supplier Account',
      description: 'Create a new supplier account',
      hidden: false,
    },
    operation: {
      inputFields: zapierResources.supplier.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
      })),
      outputFields: [
        { key: 'id', label: 'Supplier ID', type: 'string' },
        { key: 'email', label: 'Email', type: 'string' },
        { key: 'createdAt', label: 'Created At', type: 'datetime' },
      ],
      perform: async (z: any, bundle: any) => {
        return [];
      },
    },
  },
};

// Helper to extract org ID from Zapier bundle
export function extractOrgIdFromBundle(bundle: any): string {
  const authData = bundle.authData || {};
  return authData.organizationId || '';
}

// Helper to validate Zapier request signature (HMAC-SHA256)
export function validateZapierSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return signature === expectedSignature;
}
