import { requireOrgMember } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { handleRouteError } from '@/lib/validation/api';
import { predictScope3Emission } from '@/lib/jobs/workers/scope3-estimator';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'viewer');

    const body = await req.json();
    const { emissionCategoryId, facilityId } = body;

    const category = await prisma.emissionCategory.findUnique({
      where: { id: emissionCategoryId },
    });

    if (!category || category.scope !== 3) {
      return NextResponse.json(
        { success: false, error: 'Invalid Scope 3 category' },
        { status: 400 },
      );
    }

    const features = {
      headcount: 50,
      footprint: 10,
      month: new Date().getMonth() + 1,
      is_winter: [12, 1, 2].includes(new Date().getMonth()) ? 1 : 0,
    };

    const prediction = await predictScope3Emission(orgId, emissionCategoryId, features);

    if (!prediction) {
      return NextResponse.json(
        { success: false, error: 'No trained model for this category' },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: prediction });
  } catch (error) {
    return handleRouteError(error);
  }
}
