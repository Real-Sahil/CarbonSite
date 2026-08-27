import { requireOrgMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError, apiError } from '@/lib/validation/api';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const apiKeys = await prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        prefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: apiKeys });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return apiError('INVALID_NAME', 'Name is required', 400);
    }

    const keySecret = `sk_${randomBytes(32).toString('hex')}`;
    const prefix = keySecret.substring(0, 8);

    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name,
        prefix,
        keyHash: Buffer.from(keySecret).toString('base64'),
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: apiKey.id,
          key: keySecret,
          warning: 'Save this key securely. It will not be shown again.',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
