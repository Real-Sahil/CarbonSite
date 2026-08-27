import { NextRequest, NextResponse } from 'next/server';
import { validateZapierConfig, extractOrgIdFromBundle } from '@/lib/integrations/zapier';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    validateZapierConfig();

    const body = await req.json();
    const { authData } = body;

    if (!authData?.organizationId) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Organization ID required' },
        { status: 400 },
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: authData.organizationId },
    });

    if (!org) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        { status: 404 },
      );
    }

    // Return success with org details
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      organization: {
        id: org.id,
        name: org.name,
      },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Authentication test failed';
    return NextResponse.json(
      { code: 'AUTH_ERROR', message: errorMessage },
      { status: 500 },
    );
  }
}
