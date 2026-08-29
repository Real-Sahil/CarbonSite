import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOrgMember } from '@/lib/auth/session';
import { apiError, handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';

const SsoConfigurationSchema = z.object({
  provider: z.enum(['okta', 'azure_ad', 'google_workspace', 'generic_oidc', 'saml']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  metadataUrl: z.string().url(),
  autoCreateUsers: z.boolean().default(true),
  autoAssignRole: z
    .enum(['admin', 'editor', 'reviewer', 'viewer', 'auditor', 'field_worker'])
    .nullable()
    .optional(),
  enabled: z.boolean().default(false),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const config = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!config) {
      return NextResponse.json(null, { status: 404 });
    }

    return NextResponse.json({
      id: config.id,
      organizationId: config.organizationId,
      provider: config.provider,
      clientId: config.clientId,
      clientSecret: '***hidden***',
      metadataUrl: config.metadataUrl,
      autoCreateUsers: config.autoCreateUsers,
      autoAssignRole: config.autoAssignRole,
      enabled: config.enabled,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    });
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
    await requireOrgMember(orgId, 'admin');

    const body = await req.json();
    const validatedData = SsoConfigurationSchema.parse(body);

    const existingConfig = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (existingConfig) {
      return apiError(
        'SSO_CONFIG_EXISTS',
        'SSO configuration already exists for this organization. Use PATCH to update.',
        400
      );
    }

    const config = await prisma.ssoConfiguration.create({
      data: {
        organizationId: orgId,
        provider: validatedData.provider,
        clientId: validatedData.clientId,
        clientSecret: validatedData.clientSecret,
        metadataUrl: validatedData.metadataUrl,
        autoCreateUsers: validatedData.autoCreateUsers,
        autoAssignRole: validatedData.autoAssignRole || null,
        enabled: validatedData.enabled,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'sso_config.created',
        resourceType: 'SsoConfiguration',
        resourceId: config.id,
        metadata: {
          provider: config.provider,
        },
      },
    });

    return NextResponse.json(
      {
        id: config.id,
        organizationId: config.organizationId,
        provider: config.provider,
        clientId: config.clientId,
        clientSecret: '***hidden***',
        metadataUrl: config.metadataUrl,
        autoCreateUsers: config.autoCreateUsers,
        autoAssignRole: config.autoAssignRole,
        enabled: config.enabled,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const body = await req.json();
    const validatedData = SsoConfigurationSchema.partial().parse(body);

    const existingConfig = await prisma.ssoConfiguration.findUnique({
      where: { organizationId: orgId },
    });

    if (!existingConfig) {
      return apiError(
        'SSO_CONFIG_NOT_FOUND',
        'No SSO configuration exists for this organization. Use POST to create.',
        404
      );
    }

    const updateData: Record<string, unknown> = {};

    if (validatedData.provider !== undefined) updateData.provider = validatedData.provider;
    if (validatedData.clientId !== undefined) updateData.clientId = validatedData.clientId;
    if (validatedData.clientSecret !== undefined && validatedData.clientSecret !== '***hidden***') {
      updateData.clientSecret = validatedData.clientSecret;
    }
    if (validatedData.metadataUrl !== undefined) updateData.metadataUrl = validatedData.metadataUrl;
    if (validatedData.autoCreateUsers !== undefined) updateData.autoCreateUsers = validatedData.autoCreateUsers;
    if (validatedData.autoAssignRole !== undefined) updateData.autoAssignRole = validatedData.autoAssignRole;
    if (validatedData.enabled !== undefined) updateData.enabled = validatedData.enabled;

    const config = await prisma.ssoConfiguration.update({
      where: { organizationId: orgId },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: 'sso_config.updated',
        resourceType: 'SsoConfiguration',
        resourceId: config.id,
        metadata: {
          changes: Object.keys(updateData),
        },
      },
    });

    return NextResponse.json({
      id: config.id,
      organizationId: config.organizationId,
      provider: config.provider,
      clientId: config.clientId,
      clientSecret: '***hidden***',
      metadataUrl: config.metadataUrl,
      autoCreateUsers: config.autoCreateUsers,
      autoAssignRole: config.autoAssignRole,
      enabled: config.enabled,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
