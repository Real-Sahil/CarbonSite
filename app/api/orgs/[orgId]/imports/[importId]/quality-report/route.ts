import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';
import { scoreImportQuality, calculateMetrics } from '@/lib/data-quality/quality-scorer';
import { z } from 'zod';

const paramSchema = z.object({
  importId: z.string().cuid(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; importId: string }> }
) {
  try {
    const { orgId, importId } = await params;
    await requireOrgMember(orgId, 'viewer', 'reviewer', 'editor', 'admin', 'auditor');

    paramSchema.parse({ importId });

    const importBatch = await prisma.importBatch.findUniqueOrThrow({
      where: { id: importId },
      include: {
        qualityChecks: {
          orderBy: { createdAt: 'desc' },
        },
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (importBatch.organizationId !== orgId) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Organization mismatch' },
        { status: 403 }
      );
    }

    // Calculate quality score from existing checks
    const qualityScore = await scoreImportQuality(importId, importBatch.qualityChecks);

    // Get broader metrics across recent imports
    const metrics = await calculateMetrics(orgId, importId);

    return NextResponse.json({
      success: true,
      batchName: `Import ${importBatch.id.slice(0, 8)}`,
      importDate: importBatch.createdAt,
      totalRows: importBatch.rowCount ?? 0,
      successfulRows: (importBatch.rowCount ?? 0) - importBatch.errorCount,
      qualityScore,
      metrics,
      checks: importBatch.qualityChecks.map((check) => ({
        id: check.id,
        type: check.checkType,
        name: check.checkName,
        passed: check.passed,
        failuresCount: check.failuresCount,
        failureSamples: check.failureSamples,
        metadata: check.metadata,
        createdAt: check.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
