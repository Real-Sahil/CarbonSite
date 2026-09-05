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
import { permitUrgency, permitSortRank, daysUntil } from "@/lib/environment/permits";
import { CreatePermitForm } from "./permit-form";

const MANAGE_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "operations_manager",
  "editor",
];

const PERMIT_TYPE_LABEL: Record<string, string> = {
  environmental_permit: "Environmental permit",
  discharge_consent: "Discharge consent",
  abstraction_licence: "Abstraction licence",
  waste_carrier_licence: "Waste carrier licence",
  waste_management_licence: "Waste management licence",
  air_emissions_permit: "Air emissions permit",
  radioactive_substances: "Radioactive substances",
  species_licence: "Species licence",
  planning_condition: "Planning condition",
  other: "Other",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function PermitsPage({ params }: PageProps) {
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

  const [permits, facilities] = await Promise.all([
    prisma.environmentalPermit.findMany({
      where: { organizationId: orgId },
      include: {
        facility: { select: { name: true } },
        owner: { select: { name: true, email: true } },
        conditions: {
          orderBy: { reference: "asc" },
          select: {
            id: true,
            reference: true,
            description: true,
            complianceStatus: true,
            nextDueOn: true,
          },
        },
      },
    }),
    prisma.facility.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const now = new Date();
  const rows = permits
    .map((p) => ({ ...p, urgency: permitUrgency(p, now) }))
    .sort((a, b) => {
      const rank = permitSortRank(a.urgency) - permitSortRank(b.urgency);
      if (rank !== 0) return rank;
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Permits and consents</h1>
          <p className="mt-0.5 max-w-[65ch] text-sm text-zinc-500">
            Every permit, consent, licence and registration the organisation holds, with
            compliance tracked per numbered condition.
          </p>
        </div>
        {canManage && <CreatePermitForm orgId={orgId} facilities={facilities} />}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-zinc-500">
            No permits recorded. Add the permits, consents and registrations this organisation
            holds so renewals are tracked before they lapse.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Permit</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Expiry</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => {
                  const days = p.expiresOn ? daysUntil(p.expiresOn, now) : null;
                  const breaches = p.conditions.filter(
                    (c) => c.complianceStatus === "breach",
                  ).length;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium text-zinc-900">{p.title}</div>
                        <div className="text-xs text-zinc-500">
                          {PERMIT_TYPE_LABEL[p.type] ?? p.type} · {p.reference}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-zinc-500">{p.issuingAuthority}</TableCell>
                      <TableCell className="text-sm text-zinc-500">
                        {p.facility?.name ?? "Organisation wide"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.conditions.length === 0 ? (
                          <span className="text-zinc-500">None recorded</span>
                        ) : breaches > 0 ? (
                          <span className="font-medium text-red-700">
                            {breaches} of {p.conditions.length} in breach
                          </span>
                        ) : (
                          <span className="text-zinc-500">{p.conditions.length} tracked</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {p.urgency === "expired" ? (
                          <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">
                            Expired
                          </Badge>
                        ) : p.urgency === "renewal_due" ? (
                          <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                            {days} days
                          </Badge>
                        ) : (
                          <span className="font-mono text-sm tabular-nums text-zinc-500">
                            {p.expiresOn
                              ? p.expiresOn.toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "No expiry"}
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

function Denied() {
  return (
    <div className="p-8">
      <h1 className="text-lg font-semibold text-zinc-900">Access denied</h1>
      <p className="mt-1 text-sm text-zinc-500">
        You do not have permission to view the permit register.
      </p>
    </div>
  );
}
