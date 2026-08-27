import { NextRequest, NextResponse } from 'next/server';
import { requireOrgMember } from '@/lib/auth/session';
import { handleRouteError } from '@/lib/validation/api';
import { z } from 'zod';
import { getUnacknowledgedAnomalies, acknowledgeAnomaly } from '@/lib/suppliers/anomaly-detector';

const AcknowledgeAnomalySchema = z.object({
  note: z.string().optional(),
});

/**
 * GET /api/orgs/[orgId]/supplier-anomalies
 * List unacknowledged anomalies for the organization
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    await requireOrgMember(orgId, 'admin', 'editor');

    const severity = req.nextUrl.searchParams.get('severity') as 'warning' | 'critical' | null;

    const anomalies = await getUnacknowledgedAnomalies(orgId, {
      severity: severity || undefined,
    });

    return NextResponse.json({ anomalies }, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/orgs/[orgId]/supplier-anomalies/[anomalyId]/acknowledge
 * Acknowledge an anomaly
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { orgId } = await params;
    const user = await requireOrgMember(orgId, 'admin', 'editor');

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const anomalyId = pathParts[pathParts.indexOf('supplier-anomalies') + 1];

    if (!anomalyId || !pathParts[pathParts.indexOf(anomalyId) + 1]?.includes('acknowledge')) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'Anomaly ID required' },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { note } = AcknowledgeAnomalySchema.parse(body);

    const anomaly = await acknowledgeAnomaly(orgId, anomalyId, user.session.user.id, note);

    return NextResponse.json(anomaly, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
