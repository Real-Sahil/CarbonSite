import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { OrgRole } from "@prisma/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateContractForm, DeleteContractButton } from "./contract-actions";

interface Props {
  params: Promise<{ orgId: string }>;
}

const EDIT_ROLES: OrgRole[] = ["admin", "sustainability_director", "contract_manager"];

function contractStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>;
    case "completed":
      return <Badge variant="secondary">Completed</Badge>;
    case "suspended":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">Suspended</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(value: unknown) {
  const num = Number(value ?? 0);
  if (!num) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(num);
}

function formatTco2e(kgCo2e: number): string {
  if (kgCo2e === 0) return "— tCO₂e";
  const tCo2e = kgCo2e / 1000;
  return `${tCo2e.toFixed(2)} tCO₂e`;
}

type ContractCo2eRow = { contract_id: string; total_co2e: number };

export default async function ContractsPage({ params }: Props) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(
      orgId,
      "admin",
      "sustainability_director",
      "sustainability_manager",
      "operations_manager",
      "editor",
      "reviewer",
      "viewer",
      "auditor",
      "contract_manager",
      "project_manager",
      "site_manager",
      "supervisor",
      "employee",
      "client_viewer",
    );
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canEdit = EDIT_ROLES.includes(role);

  const [contracts, co2eRows] = await Promise.all([
    prisma.contract.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRaw<ContractCo2eRow[]>`
      SELECT
        c.id AS contract_id,
        COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
      FROM contracts c
      LEFT JOIN projects p ON p.contract_id = c.id
      LEFT JOIN sites s ON s.project_id = p.id
      LEFT JOIN activity_records ar ON ar.site_id = s.id
      LEFT JOIN LATERAL (
        SELECT total_co2e
        FROM emission_calculations
        WHERE activity_record_id = ar.id
        ORDER BY created_at DESC
        LIMIT 1
      ) ec ON true
      WHERE c.organization_id = ${Prisma.raw(`'${orgId}'`)}
      GROUP BY c.id
    `,
  ]);

  // Also include CO2e from activity_records linked directly via contractId
  const directCo2eRows = await prisma.$queryRaw<ContractCo2eRow[]>`
    SELECT
      ar.contract_id,
      COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
    FROM activity_records ar
    LEFT JOIN LATERAL (
      SELECT total_co2e
      FROM emission_calculations
      WHERE activity_record_id = ar.id
      ORDER BY created_at DESC
      LIMIT 1
    ) ec ON true
    WHERE ar.organization_id = ${Prisma.raw(`'${orgId}'`)}
      AND ar.contract_id IS NOT NULL
      AND ar.site_id IS NULL
    GROUP BY ar.contract_id
  `;

  const co2eByContract = new Map<string, number>();
  for (const row of co2eRows) {
    co2eByContract.set(row.contract_id, Number(row.total_co2e));
  }
  for (const row of directCo2eRows) {
    if (row.contract_id) {
      co2eByContract.set(
        row.contract_id,
        (co2eByContract.get(row.contract_id) ?? 0) + Number(row.total_co2e),
      );
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF]">
              <Building2 className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Contracts
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Contracts
          </h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Manage contracts, projects, and sites for your organisation.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              All contracts
              <span className="ml-2 text-xs font-normal text-[#9CA3AF]">
                ({contracts.length})
              </span>
            </CardTitle>
            <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
              {contracts.length} contract{contracts.length !== 1 ? "s" : ""} in this organisation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-0 p-0">
            {canEdit && (
              <div className="px-6 py-5 border-b border-[#E5E7EB]">
                <CreateContractForm orgId={orgId} />
              </div>
            )}

            {contracts.length === 0 ? (
              <EmptyState message="No contracts yet. Create one above to get started." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pl-6">Name</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Client</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Value</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Start</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">End</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">Projects</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3">CO2e</TableHead>
                      <TableHead className="text-xs font-medium text-[#9CA3AF] py-3 pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contracts.map((contract) => (
                      <TableRow key={contract.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="text-sm font-medium text-[#111827] py-3.5 pl-6">
                          <Link
                            href={`/orgs/${orgId}/contracts/${contract.id}`}
                            className="hover:underline underline-offset-2"
                          >
                            {contract.name}
                          </Link>
                        </TableCell>
                        <TableCell className="py-3.5">{contractStatusBadge(contract.status)}</TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {contract.clientName ?? "-"}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {formatCurrency(contract.contractValue)}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {formatDate(contract.startDate)}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {formatDate(contract.endDate)}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {contract._count.projects}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5 tabular-nums">
                          {formatTco2e(co2eByContract.get(contract.id) ?? 0)}
                        </TableCell>
                        <TableCell className="py-3.5 pr-6">
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" variant="outline" className="border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]">
                              <Link href={`/orgs/${orgId}/contracts/${contract.id}`}>View</Link>
                            </Button>
                            {canEdit && (
                              <DeleteContractButton
                                orgId={orgId}
                                contractId={contract.id}
                                name={contract.name}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view contracts.</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#BAE6FD] bg-[#F0F9FF] p-[42px] text-center">
      <Building2 className="h-8 w-8 text-[#111827] opacity-40" />
      <p className="text-sm text-[#374151] tracking-[-0.42px]">{message}</p>
    </div>
  );
}
