import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { prisma } from '@/lib/db';
import { validateImportBatch, saveQualityCheckResults } from '@/lib/validation/data-quality';
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
        stagedRecords: {
          select: {
            rowNumber: true,
            data: true,
            validationErrors: true,
            validationWarnings: true,
            status: true,
          },
        },
        qualityScore: true,
        qualityChecks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (importBatch.organizationId !== orgId) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Organization mismatch' },
        { status: 403 }
      );
    }

    // If quality checks already ran, return cached result
    if (importBatch.qualityScore) {
      return NextResponse.json({
        success: true,
        qualityScore: {
          overallScore: importBatch.qualityScore.overallScore,
          checksPassed: importBatch.qualityScore.checksPassed,
          checksTotal: importBatch.qualityScore.checksTotal,
          canCommit: importBatch.qualityScore.canCommit,
        },
        checks: importBatch.qualityChecks.map((check) => ({
          type: check.checkType,
          name: check.checkName,
          passed: check.passed,
          failuresCount: check.failuresCount,
          failureSamples: check.failureSamples,
        })),
        cachedAt: importBatch.qualityScore.createdAt,
      });
    }

    // Prepare records for validation
    const records = importBatch.stagedRecords.map((record: any) => ({
      ...record.data,
      rowNumber: record.rowNumber,
    }));

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        qualityScore: {
          overallScore: 0,
          checksPassed: 0,
          checksTotal: 0,
          canCommit: false,
        },
        checks: [],
        message: 'No records to validate',
      });
    }

    // Run quality checks
    const checkResults = await validateImportBatch(importId, orgId, records);

    // Save results to database
    const { overallScore, canCommit } = await saveQualityCheckResults(
      importId,
      orgId,
      checkResults
    );

    return NextResponse.json({
      success: true,
      qualityScore: {
        overallScore,
        checksPassed: checkResults.filter((c) => c.passed).length,
        checksTotal: checkResults.length,
        canCommit,
      },
      checks: checkResults.map((check) => ({
        type: check.type,
        name: check.name,
        passed: check.passed,
        failuresCount: check.failures?.length || 0,
        failureSamples: check.failures,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
