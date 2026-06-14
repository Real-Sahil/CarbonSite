import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
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

  const contracts = await prisma.contract.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { projects: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Contracts
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Contracts
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
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
            <div className="rounded-[14px] border border-[#e5e7eb] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f9fafb]">
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Name</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Status</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Client</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Value</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Start</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">End</TableHead>
                    <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Projects</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id} className="hover:bg-[#f9fafb]">
                      <TableCell className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                        <Link
                          href={`/orgs/${orgId}/contracts/${contract.id}`}
                          className="hover:underline"
                        >
                          {contract.name}
                        </Link>
                      </TableCell>
                      <TableCell>{contractStatusBadge(contract.status)}</TableCell>
                      <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                        {contract.clientName ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                        {formatCurrency(contract.contractValue)}
                      </TableCell>
                      <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                        {formatDate(contract.startDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                        {formatDate(contract.endDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                        {contract._count.projects}
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
    <div className="min-h-screen flex items-center justify-center bg-[#fffefc]">
      <div className="text-center">
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17] mb-[7px]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Access denied
        </h1>
        <p className="text-sm text-[#222222] tracking-[-0.42px]">
          You do not have permission to view contracts.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-[42px] text-center">
      <Building2 className="h-8 w-8 text-[#0f3e17] opacity-40" />
      <p className="text-sm text-[#222222] tracking-[-0.42px]">{message}</p>
    </div>
  );
}
