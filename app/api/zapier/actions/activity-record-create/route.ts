import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateZapierConfig, verifyZapierApiKey, ZapierAuthError } from '@/lib/integrations/zapier';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/db/audit';
import { normalizeUnit } from '@/lib/calculation/units';

const createActivityRecordSchema = z.object({
  organizationId: z.string().min(1),
  apiKey: z.string().min(1),
  quantity: z.number().min(0),
  unit: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  facilityId: z.string().optional(),
  date: z.string().datetime().optional(),
  source: z.string().default('zapier'),
});

export async function POST(req: NextRequest) {
  try {
    validateZapierConfig();

    const body = await req.json();
    const input = createActivityRecordSchema.parse(body);

    // This endpoint has no session/cookie — it's called by Zapier's
    // servers, not a logged-in browser — so the API key is the only thing
    // authenticating the caller to this org.
    try {
      await verifyZapierApiKey(input.organizationId, input.apiKey);
    } catch (err) {
      if (err instanceof ZapierAuthError) {
        return NextResponse.json({ code: 'UNAUTHORIZED', message: err.message }, { status: 401 });
      }
      throw err;
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
    });

    if (!org) {
      return NextResponse.json(
        { code: 'NOT_FOUND', message: 'Organization not found' },
        { status: 404 },
      );
    }

    // Verify category exists
    const category = await prisma.emissionCategory.findUnique({
      where: { code: input.category },
    });

    if (!category) {
      return NextResponse.json(
        { code: 'INVALID_CATEGORY', message: `Category ${input.category} not found` },
        { status: 400 },
      );
    }

    // If facilityId provided, verify it belongs to org
    if (input.facilityId) {
      const facility = await prisma.facility.findUnique({
        where: { id: input.facilityId },
      });

      if (!facility || facility.organizationId !== input.organizationId) {
        return NextResponse.json(
          { code: 'NOT_FOUND', message: 'Facility not found in this organization' },
          { status: 404 },
        );
      }
    }

    // Get current reporting period
    const reportingPeriod = await prisma.reportingPeriod.findFirst({
      where: { organizationId: input.organizationId },
      orderBy: { endDate: 'desc' },
    });

    if (!reportingPeriod) {
      return NextResponse.json(
        { code: 'NO_PERIOD', message: 'No active reporting period found' },
        { status: 400 },
      );
    }

    // Normalize unit
    const normalized = normalizeUnit(input.quantity, input.unit);

    // Get a system user ID for audit trail (Zapier integration user)
    // In production, create a dedicated Zapier system user
    const adminMember = await prisma.organizationMembership.findFirst({
      where: { organizationId: input.organizationId },
      include: { user: true },
    });

    const createdByUserId = adminMember?.userId || '';

    // Create activity record
    const record = await prisma.activityRecord.create({
      data: {
        organizationId: input.organizationId,
        reportingPeriodId: reportingPeriod.id,
        emissionCategoryId: input.category,
        facilityId: input.facilityId || null,
        amount: normalized.amount,
        unit: normalized.unit,
        sourceDescription: input.description || `Created via Zapier integration`,
        reviewStatus: 'draft',
        createdByUserId,
        activityDate: input.date ? new Date(input.date) : new Date(),
      },
    });

    // Log audit event
    await writeAuditLog({
      organizationId: input.organizationId,
      actorUserId: createdByUserId || undefined,
      action: 'record.created',
      resourceType: 'ActivityRecord',
      resourceId: record.id,
      metadata: {
        source: 'zapier',
        category: input.category,
        amount: normalized.amount,
        unit: normalized.unit,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Activity record created successfully',
        record: {
          id: record.id,
          amount: record.amount.toString(),
          unit: record.unit,
          category: record.emissionCategoryId,
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { code: 'VALIDATION_ERROR', message: 'Invalid input', errors: err.errors },
        { status: 400 },
      );
    }

    const errorMessage = err instanceof Error ? err.message : 'Failed to create activity record';
    return NextResponse.json(
      { code: 'ERROR', message: errorMessage },
      { status: 500 },
    );
  }
}
