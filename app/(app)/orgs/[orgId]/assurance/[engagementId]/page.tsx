export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import { checkSignOffReadiness } from "@/lib/assurance/engagement";
import { EngagementWorkspace } from "./workspace";

const MANAGE_ROLES: OrgRole[] = ["admin", "sustainability_director", "auditor"];
const RESPOND_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager", "editor"];

interface PageProps {
  params: Promise<{ orgId: string; engagementId: string }>;
}

export default async function EngagementDetailPage({ params }: PageProps) {
  const { orgId, engagementId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <Denied />;
    }
    throw err;
  }

  const engagement = await prisma.assuranceEngagement.findFirst({
    where: { id: engagementId, organizationId: orgId },
    include: {
      reportingPeriod: { select: { label: true } },
      evidenceRequests: {
        orderBy: { reference: "asc" },
        include: { owner: { select: { name: true, email: true } } },
      },
      samples: {
        orderBy: { createdAt: "desc" },
        include: {
          emissionCalculation: {
            select: {
              totalCo2e: true,
              activityRecord: { select: { sourceDescription: true, dataOrigin: true } },
            },
          },
        },
      },
      findings: {
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        include: {
          raisedBy: { select: { name: true, email: true } },
          respondedBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!engagement) notFound();

  const readiness = checkSignOffReadiness({
    findings: engagement.findings,
    evidenceRequests: engagement.evidenceRequests,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <Link
        href={`/orgs/${orgId}/assurance`}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All engagements
      </Link>

      <EngagementWorkspace
        orgId={orgId}
        canManage={MANAGE_ROLES.includes(role)}
        canRespond={RESPOND_ROLES.includes(role)}
        readiness={readiness}
        engagement={{
          id: engagement.id,
          providerName: engagement.providerName,
          leadAssurorName: engagement.leadAssurorName,
          standard: engagement.standard,
          level: engagement.level,
          status: engagement.status,
          reportingPeriodLabel: engagement.reportingPeriod.label,
          materialityThresholdCo2e:
            engagement.materialityThresholdCo2e === null ? null : Number(engagement.materialityThresholdCo2e),
          materialityThresholdPercent:
            engagement.materialityThresholdPercent === null ? null : Number(engagement.materialityThresholdPercent),
          opinionSummary: engagement.opinionSummary,
          opinionIssuedAt: engagement.opinionIssuedAt?.toISOString() ?? null,
        }}
        evidenceRequests={engagement.evidenceRequests.map((e) => ({
          id: e.id,
          reference: e.reference,
          description: e.description,
          status: e.status,
          dueOn: e.dueOn?.toISOString() ?? null,
          owner: e.owner ? (e.owner.name ?? e.owner.email) : null,
          unavailabilityReason: e.unavailabilityReason,
        }))}
        samples={engagement.samples.map((s) => ({
          id: s.id,
          samplingMethod: s.samplingMethod,
          selectionRationale: s.selectionRationale,
          testProcedure: s.testProcedure,
          result: s.result,
          testNotes: s.testNotes,
          sourceDescription: s.emissionCalculation?.activityRecord.sourceDescription ?? null,
          dataOrigin: s.emissionCalculation?.activityRecord.dataOrigin ?? null,
          totalCo2e: s.emissionCalculation ? Number(s.emissionCalculation.totalCo2e) : null,
        }))}
        findings={engagement.findings.map((f) => ({
          id: f.id,
          severity: f.severity,
          status: f.status,
          title: f.title,
          description: f.description,
          quantifiedImpactCo2e: f.quantifiedImpactCo2e === null ? null : Number(f.quantifiedImpactCo2e),
          managementResponse: f.managementResponse,
          raisedBy: f.raisedBy.name ?? f.raisedBy.email,
        }))}
      />
    </div>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">You do not have permission to view this engagement.</p>
    </div>
  );
}
