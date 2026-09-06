import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateZapierConfig, verifyZapierApiKey, ZapierAuthError } from '@/lib/integrations/zapier';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/db/audit';

const createSupplierSchema = z.object({
  organizationId: z.string().min(1),
  apiKey: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  company: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    validateZapierConfig();

    const body = await req.json();
    const input = createSupplierSchema.parse(body);

    // This endpoint creates a real User + OrganizationMembership from an
    // unauthenticated-looking request — it MUST verify the caller holds
    // this org's Zapier credential before doing anything, or anyone on the
    // internet could provision themselves an account in any org.
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

    // Check if supplier already exists
    const existingSupplier = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingSupplier) {
      return NextResponse.json(
        {
          code: 'ALREADY_EXISTS',
          message: 'Supplier with this email already exists',
          supplier: {
            id: existingSupplier.id,
            email: existingSupplier.email,
          },
        },
        { status: 409 },
      );
    }

    // Create supplier user account (simplified - production would use Better Auth)
    const supplier = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        emailVerified: true,
      },
    });

    // Add supplier to organization with 'field_worker' role (or 'supplier' if available)
    await prisma.organizationMembership.create({
      data: {
        organizationId: input.organizationId,
        userId: supplier.id,
        role: 'field_worker', // Could also be 'supplier' if role exists
      },
    });

    // Log audit event
    await writeAuditLog({
      organizationId: input.organizationId,
      action: 'supplier_account.created',
      resourceType: 'Supplier',
      resourceId: supplier.id,
      metadata: {
        source: 'zapier',
        email: input.email,
        company: input.company,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Supplier account created successfully',
        supplier: {
          id: supplier.id,
          email: supplier.email,
          name: supplier.name,
          createdAt: supplier.createdAt,
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

    const errorMessage = err instanceof Error ? err.message : 'Failed to create supplier account';
    return NextResponse.json(
      { code: 'ERROR', message: errorMessage },
      { status: 500 },
    );
  }
}
