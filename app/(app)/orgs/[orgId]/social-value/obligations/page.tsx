export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { loadObligations } from "@/lib/social-value/obligations-load";
import type { ObligationState } from "@/lib/social-value/obligations";
import { ObligationActions, ObligationForm } from "./obligation-forms";

const VIEW_ROLES: OrgRole[] = [
  "admin", "sustainability_director", "sustainability_manager", "contract_manager",
  "editor", "reviewer", "viewer", "auditor",
];
const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director", "sustainability_manager", "contract_manager"];

const STATE: Record<ObligationState, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  overdue: { label: "Overdue", variant: "destructive" },
  due_soon: { label: "Due soon", variant: "default" },
  open: { label: "Open", variant: "outline" },
  met: { label: "Met", variant: "secondary" },
  waived: { label: "Waived", variant: "secondary" },
};
const date = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No date");

export default async function ObligationsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  let role: OrgRole;
  try {
    role = (await requireOrgMember(orgId, ...VIEW_ROLES)).membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <p className="p-6 text-sm">You do not have access to this page.</p>;
    }
    throw err;
  }
  const canEdit = EDIT_ROLES.includes(role);
  const [obligations, sites] = await Promise.all([
    loadObligations(orgId),
    prisma.site.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  const counts = {
    overdue: obligations.filter((o) => o.state === "overdue").length,
    dueSoon: obligations.filter((o) => o.state === "due_soon").length,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Planning obligations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What each site&apos;s Section 106 agreement or planning conditions require, and whether it is on track.
          Link an obligation to a social value commitment and its approved activities count as delivery, in the obligation&apos;s unit.
        </p>
        {obligations.length > 0 && (
          <p className="mt-2 text-sm tabular-nums" role="status">
            {counts.overdue} overdue, {counts.dueSoon} due within 60 days.
          </p>
        )}
      </header>

      {canEdit && (
        <Card>
          <CardHeader><CardTitle>Add an obligation</CardTitle><CardDescription>Copy the duty from the agreement; add the clause so it can be found again.</CardDescription></CardHeader>
          <CardContent><ObligationForm orgId={orgId} sites={sites} /></CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {obligations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No obligations recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obligation</TableHead><TableHead>Site</TableHead><TableHead>Due</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Delivered</TableHead>
                  {canEdit && <TableHead><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {obligations.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <div className="font-medium">{o.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {[o.reference, o.authority, o.clause].filter(Boolean).join(" · ") || "No reference"}
                      </div>
                    </TableCell>
                    <TableCell>{o.siteName ?? "Not site-specific"}</TableCell>
                    <TableCell className="tabular-nums">{date(o.dueDate)}</TableCell>
                    <TableCell><Badge variant={STATE[o.state].variant}>{STATE[o.state].label}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.progress
                        ? `${o.progress.delivered}${o.target.value ? ` of ${o.target.value}` : ""} ${o.target.unit ?? ""}${o.progress.pct !== null ? ` (${o.progress.pct}%)` : ""}${o.progress.unitMismatch ? " (other units not counted)" : ""}`
                        : o.target.value ? `Target ${o.target.value} ${o.target.unit ?? ""}` : "No target"}
                    </TableCell>
                    {canEdit && <TableCell><ObligationActions orgId={orgId} id={o.id} status={o.status} title={o.title} /></TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
