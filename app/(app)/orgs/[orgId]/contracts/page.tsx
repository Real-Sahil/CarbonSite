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
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Contracts
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827]"
          
        >
          Contracts
        </h1>
        <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
          Manage contracts, projects, and sites for your organisation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All contracts</CardTitle>
          <CardDescription>
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""} in this organisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canEdit && <CreateContractForm orgId={orgId} />}

          {contracts.length === 0 ? (
            <EmptyState message="No contracts yet. Create one above to get started." />
          ) : (
            <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f9fafb]">
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Name</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Status</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Client</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Value</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Start</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">End</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Projects</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">CO₂e</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id} className="hover:bg-[#f9fafb]">
                      <TableCell className="font-normal text-[#111827] tracking-[-0.42px]">
                        <Link
                          href={`/orgs/${orgId}/contracts/${contract.id}`}
                          className="hover:underline"
                        >
                          {contract.name}
                        </Link>
                      </TableCell>
                      <TableCell>{contractStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {contract.clientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatCurrency(contract.contractValue)}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatDate(contract.startDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatDate(contract.endDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {contract._count.projects}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatTco2e(co2eByContract.get(contract.id) ?? 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline">
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
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827] mb-1"
          
        >
          Access denied
        </h1>
        <p className="text-sm text-[#374151] tracking-[-0.42px]">
          You do not have permission to view contracts.
        </p>
      </div>
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
