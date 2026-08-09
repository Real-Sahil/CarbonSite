import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, MinusCircle } from "lucide-react";
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
import { CreateProjectForm, DeleteProjectButton } from "./project-actions";

interface Props {
  params: Promise<{ orgId: string; contractId: string }>;
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

function projectStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>;
    case "completed":
      return <Badge variant="secondary">Completed</Badge>;
    case "on_hold":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">On hold</Badge>;
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

function FlagCell({ value, label }: { value: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {value ? (
        <CheckCircle2 className="h-4 w-4 text-[#111827]" aria-hidden="true" />
      ) : (
        <MinusCircle className="h-4 w-4 text-[#999]" aria-hidden="true" />
      )}
      <span className="text-sm text-[#374151] tracking-[-0.42px]">{label}</span>
    </div>
  );
}

export default async function ContractDetailPage({ params }: Props) {
  const { orgId, contractId } = await params;

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

  const [contract, projects, co2eResult] = await Promise.all([
    prisma.contract.findUniqueOrThrow({
      where: { id: contractId, organizationId: orgId },
      include: { _count: { select: { projects: true } } },
    }),
    prisma.project.findMany({
      where: { contractId, organizationId: orgId },
      include: { _count: { select: { sites: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRaw<Array<{ total_co2e: number }>>`
      SELECT COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
      FROM contracts c
      LEFT JOIN projects p ON p.contract_id = c.id
      LEFT JOIN sites s ON s.project_id = p.id
      LEFT JOIN activity_records ar ON ar.site_id = s.id
      LEFT JOIN LATERAL (
        SELECT total_co2e FROM emission_calculations
        WHERE activity_record_id = ar.id
        ORDER BY created_at DESC LIMIT 1
      ) ec ON TRUE
      WHERE c.id = ${contractId}
        AND c.organization_id = ${orgId}
      GROUP BY c.id
    `,
  ]);

  const directCo2eResult = await prisma.$queryRaw<Array<{ total_co2e: number }>>`
    SELECT COALESCE(SUM(ec.total_co2e), 0)::float AS total_co2e
    FROM activity_records ar
    LEFT JOIN LATERAL (
      SELECT total_co2e FROM emission_calculations
      WHERE activity_record_id = ar.id
      ORDER BY created_at DESC LIMIT 1
    ) ec ON TRUE
    WHERE ar.organization_id = ${orgId}
      AND ar.contract_id = ${contractId}
      AND ar.site_id IS NULL
  `;

  const totalKgCo2e =
    Number(co2eResult[0]?.total_co2e ?? 0) +
    Number(directCo2eResult[0]?.total_co2e ?? 0);

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#374151] tracking-[-0.42px]">
        <Link href={`/orgs/${orgId}/contracts`} className="hover:text-[#111827] hover:underline">
          Contracts
        </Link>
        <span>/</span>
        <span className="text-[#111827]">{contract.name}</span>
      </nav>

      {/* Header */}
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Contracts
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827]"
          
        >
          {contract.name}
        </h1>
        <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
          Contract details, projects, and sites.
        </p>
      </div>

      {/* Contract details card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Contract details</CardTitle>
              <CardDescription>Key metadata and compliance flags for this contract.</CardDescription>
            </div>
            {contractStatusBadge(contract.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Client name</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{contract.clientName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Contract reference</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{contract.contractReference ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Contract value</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatCurrency(contract.contractValue)}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Start date</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatDate(contract.startDate)}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">End date</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatDate(contract.endDate)}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Projects</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{contract._count.projects}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Total CO₂e</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatTco2e(totalKgCo2e)}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-5">
            <FlagCell value={contract.ppn0621Required} label="PPN 06/21 required" />
            <FlagCell value={contract.nhsEvergreenRequired} label="NHS Evergreen required" />
            <FlagCell value={contract.breeamRequired} label="BREEAM required" />
          </div>
        </CardContent>
      </Card>

      {/* Projects card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
          <CardDescription>
            {projects.length} project{projects.length !== 1 ? "s" : ""} on this contract.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canEdit && <CreateProjectForm orgId={orgId} contractId={contractId} />}

          {projects.length === 0 ? (
            <EmptyState message="No projects yet. Create one above to get started." />
          ) : (
            <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f9fafb]">
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Name</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Project code</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Status</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Start</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">End</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Sites</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id} className="hover:bg-[#f9fafb]">
                      <TableCell className="font-normal text-[#111827] tracking-[-0.42px]">
                        <Link
                          href={`/orgs/${orgId}/contracts/${contractId}/projects/${project.id}`}
                          className="hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {project.projectCode ?? "—"}
                      </TableCell>
                      <TableCell>{projectStatusBadge(project.status)}</TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatDate(project.startDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {formatDate(project.endDate)}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {project._count.sites}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/orgs/${orgId}/contracts/${contractId}/projects/${project.id}`}>
                              View
                            </Link>
                          </Button>
                          {canEdit && (
                            <DeleteProjectButton
                              orgId={orgId}
                              contractId={contractId}
                              projectId={project.id}
                              name={project.name}
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
          You do not have permission to view this contract.
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
