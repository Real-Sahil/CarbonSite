import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { generateComplianceEvidence, createCompliancePDF } from '@/lib/compliance/evidence-generator';
import { z } from 'zod';

const exportSchema = z.object({
  reportId: z.string().cuid(),
  frameworks: z.array(
    z.enum(['csrd', 'sbti', 'cdp', 'ghg-protocol', 'iso-14064'])
  ).min(1),
  includeCalculations: z.boolean().default(true),
  includeAuditTrail: z.boolean().default(true),
  format: z.enum(['pdf', 'json']).default('pdf'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    await requireOrgMember(orgId, 'admin', 'auditor', 'reviewer');

    const body = await req.json();
    const { reportId, frameworks, includeCalculations, includeAuditTrail, format } =
      exportSchema.parse(body);

    // Generate compliance evidence
    const evidence = await generateComplianceEvidence(orgId, reportId, {
      frameworks,
      includeCalculations,
      includeAuditTrail,
    });

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: evidence,
      });
    }

    // Generate PDF
    const pdfBytes = await createCompliancePDF(evidence);
    const buffer = Buffer.from(pdfBytes);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="compliance-evidence-${reportId}.pdf"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
