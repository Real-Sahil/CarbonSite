import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createCustomFactor, getOrgCustomFactorLibrary, updateCustomFactor, deleteCustomFactor } from '@/lib/calculation/custom-factors';

const CustomFactorSchema = z.object({
  scope: z.number().int().min(1).max(3),
  emissionCategoryId: z.string().optional(),
  activityType: z.string().optional(),
  geographyCountry: z.string().optional(),
  geographyRegion: z.string().optional(),
  effectiveStartDate: z.string().datetime().optional(),
  effectiveEndDate: z.string().datetime().optional(),
  inputUnit: z.string().min(1),
  co2: z.number().optional(),
  ch4: z.number().optional(),
  n2o: z.number().optional(),
  co2e: z.number().optional(),
  uncertaintyRating: z.enum(['low', 'medium', 'high']).optional(),
  usageNotes: z.string().optional(),
  source: z.string().optional(),
});

/**
 * GET /api/orgs/[orgId]/custom-factors
 * List all custom emission factors for an organization
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin', 'editor');

    const scope = req.nextUrl.searchParams.get('scope');
    const categoryId = req.nextUrl.searchParams.get('categoryId');

    const factors = await getOrgCustomFactorLibrary(orgId, {
      scope: scope ? parseInt(scope) : undefined,
      categoryId: categoryId || undefined,
    });

    return NextResponse.json({ factors }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * POST /api/orgs/[orgId]/custom-factors
 * Create a new custom emission factor
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const user = await requireOrgMember(orgId, 'admin', 'editor');

    const body = await req.json();
    const data = CustomFactorSchema.parse(body);

    const factor = await createCustomFactor(orgId, data, user.session.user.id);

    return NextResponse.json(factor, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/orgs/[orgId]/custom-factors/[factorId]
 * Update a custom emission factor (creates new version)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin', 'editor');

    const url = new URL(req.url);
    const factorId = url.pathname.split('/').pop();

    if (!factorId) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Factor ID required' },
        { status: 400 },
      );
    }

    const body = await req.json();
    const data = CustomFactorSchema.partial().parse(body);

    const factor = await updateCustomFactor(orgId, factorId, data);

    return NextResponse.json(factor, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * DELETE /api/orgs/[orgId]/custom-factors/[factorId]
 * Delete a custom emission factor
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin');

    const url = new URL(req.url);
    const factorId = url.pathname.split('/').pop();

    if (!factorId) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Factor ID required' },
        { status: 400 },
      );
    }

    await deleteCustomFactor(orgId, factorId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
