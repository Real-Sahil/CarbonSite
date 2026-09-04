export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { OrgRole } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, ChevronRight } from "lucide-react";
import { CreateEngagementForm } from "./engagement-form";

const MANAGE_ROLES: OrgRole[] = ["admin", "sustainability_director", "auditor"];

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning",
  fieldwork: "Fieldwork",
  review: "Review",
  signed: "Signed",
  withdrawn: "Withdrawn",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function AssuranceEngagementsPage({ params }: PageProps) {
  const { orgId } = await params;

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

  const canManage = MANAGE_ROLES.includes(role);

  const [engagements, periods] = await Promise.all([
    prisma.assuranceEngagement.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      include: {
        reportingPeriod: { select: { label: true } },
        _count: { select: { evidenceRequests: true, samples: true, findings: true } },
      },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      orderBy: { startDate: "desc" },
      select: { id: true, label: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
            <ClipboardCheck className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Assurance engagements</h1>
            <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
              A scope and materiality, a prepared-by-client evidence list, a sample drawn from the
              weakest data first, and a findings log with management responses. ISAE 3000 / ISO
              14064-3.
            </p>
          </div>
        </div>
        {canManage && <CreateEngagementForm orgId={orgId} periods={periods} />}
      </header>

      {engagements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-zinc-500">
            No assurance engagements recorded. Start one when an external provider begins reviewing
            a reporting period, so the evidence trail builds as work happens rather than after.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {engagements.map((e) => (
            <Link key={e.id} href={`/orgs/${orgId}/assurance/${e.id}`}>
              <Card className="transition-colors hover:border-zinc-300">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{e.providerName}</CardTitle>
                      <CardDescription>
                        {e.reportingPeriod.label} · {e.level} assurance under {e.standard}
                      </CardDescription>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-zinc-500">
                    <span>{e._count.evidenceRequests} evidence requests</span>
                    <span>{e._count.samples} samples</span>
                    <span>{e._count.findings} findings</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-sm font-medium text-zinc-600">
                    Open workspace
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "signed") {
    return <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">Signed</Badge>;
  }
  if (status === "withdrawn") {
    return (
      <Badge variant="outline" className="text-xs text-zinc-400">
        Withdrawn
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view assurance engagements.
      </p>
    </div>
  );
}
