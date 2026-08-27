import { NextRequest, NextResponse } from 'next/server';
import { validateZapierConfig } from '@/lib/integrations/zapier';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    validateZapierConfig();

    const { searchParams } = new URL(req.url);
    const resourceType = searchParams.get('type');
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Organization ID required' },
        { status: 400 },
      );
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        { status: 404 },
      );
    }

    // Return available resources based on type
    if (resourceType === 'categories') {
      const categories = await prisma.emissionCategory.findMany({
        select: {
          code: true,
          name: true,
          scope: true,
        },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({
        categories: categories.map((cat) => ({
          id: cat.code,
          name: `${cat.name} (${cat.scope})`,
        })),
      });
    }

    if (resourceType === 'facilities') {
      const facilities = await prisma.facility.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({
        facilities: facilities.map((fac) => ({
          id: fac.id,
          name: fac.name,
        })),
      });
    }

    if (resourceType === 'units') {
      return NextResponse.json({
        units: [
          { id: 'kg', name: 'Kilograms (kg)' },
          { id: 't', name: 'Tonnes (t)' },
          { id: 'g', name: 'Grams (g)' },
          { id: 'kWh', name: 'Kilowatt-hours (kWh)' },
          { id: 'MWh', name: 'Megawatt-hours (MWh)' },
          { id: 'L', name: 'Litres (L)' },
          { id: 'm3', name: 'Cubic metres (m³)' },
          { id: 'miles', name: 'Miles' },
          { id: 'km', name: 'Kilometres (km)' },
        ],
      });
    }

    // Default: return all resource types
    return NextResponse.json({
      resourceTypes: ['categories', 'facilities', 'units'],
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Resource discovery failed';
    return NextResponse.json(
      { code: 'ERROR', message: errorMessage },
      { status: 500 },
    );
  }
}
