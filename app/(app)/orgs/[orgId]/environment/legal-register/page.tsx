export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateLegalEntryForm } from "./legal-entry-form";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "editor",
];

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function LegalRegisterPage({ params }: PageProps) {
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

  const entries = await prisma.legalRegisterEntry.findMany({
    where: { organizationId: orgId },
    orderBy: [{ complianceStatus: "asc" }, { title: "asc" }],
    include: { owner: { select: { name: true, email: true } } },
  });

  const now = new Date();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Compliance obligations register</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            The environmental legislation that applies to this organisation and the compliance
            position against each entry. ISO 14001 clause 6.1.3, re-evaluated under clause 9.1.2.
          </p>
        </div>
        {canManage && <CreateLegalEntryForm orgId={orgId} />}
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">
            No entries yet. A legal register lists each instrument that binds the organisation,
            what it requires in practice, and the evidence that the requirement is being met.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Instrument</TableHead>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4">Next review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const overdue =
                    e.nextReviewOn !== null && e.nextReviewOn.getTime() < now.getTime();
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4">
                        <div className="max-w-[36ch] font-medium leading-snug text-zinc-900">
                          {e.title}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {[e.citation, e.jurisdiction].filter(Boolean).join(" · ")}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[40ch] text-xs leading-relaxed text-zinc-600">
                        {e.obligation}
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {e.owner?.name ?? e.owner?.email ?? "Unassigned"}
                      </TableCell>
                      <TableCell>
                        <ComplianceBadge status={e.complianceStatus} />
                      </TableCell>
                      <TableCell className="pr-4">
                        {e.nextReviewOn === null ? (
                          <span className="text-xs text-zinc-500">Not scheduled</span>
                        ) : overdue ? (
                          <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                            Overdue
                          </Badge>
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-zinc-500">
                            {e.nextReviewOn.toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComplianceBadge({ status }: { status: string }) {
  if (status === "breach") {
    return <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">Breach</Badge>;
  }
  if (status === "at_risk") {
    return <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">At risk</Badge>;
  }
  if (status === "compliant") {
    return (
      <Badge className="bg-green-100 text-xs text-green-900 hover:bg-green-100">Compliant</Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs">
      Not assessed
    </Badge>
  );
}

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the legal register.
      </p>
    </div>
  );
}
