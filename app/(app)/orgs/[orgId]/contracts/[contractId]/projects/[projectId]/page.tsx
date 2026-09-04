export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Target, Layers } from "lucide-react";
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
import { CreateSiteForm, DeleteSiteButton } from "./site-actions";

interface Props {
  params: Promise<{ orgId: string; contractId: string; projectId: string }>;
}

const EDIT_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "contract_manager",
  "project_manager",
  "site_manager",
];

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

export default async function ProjectDetailPage({ params }: Props) {
  const { orgId, contractId, projectId } = await params;

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

  const [project, sites, contract] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId, organizationId: orgId },
    }),
    prisma.site.findMany({
      where: { projectId, organizationId: orgId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contract.findUniqueOrThrow({
      where: { id: contractId },
      select: { name: true },
    }),
  ]);

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-[#374151] tracking-[-0.42px]">
        <Link href={`/orgs/${orgId}/contracts`} className="hover:text-[#111827] hover:underline">
          Contracts
        </Link>
        <span>/</span>
        <Link
          href={`/orgs/${orgId}/contracts/${contractId}`}
          className="hover:text-[#111827] hover:underline"
        >
          {contract.name}
        </Link>
        <span>/</span>
        <span className="text-[#111827]">{project.name}</span>
      </nav>

      {/* Header */}
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#111827] bg-[#F0F9FF] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Contracts
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#111827]"
          
        >
          {project.name}
        </h1>
        <p className="text-sm text-[#374151] font-normal tracking-[-0.42px] mt-[7px]">
          Project details and associated sites.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/carbon-budget`}>
              <Target className="mr-1.5 h-3.5 w-3.5" />
              Carbon budget
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/orgs/${orgId}/contracts/${contractId}/projects/${projectId}/whole-life-carbon`}>
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Whole-life carbon
            </Link>
          </Button>
        </div>
      </div>

      {/* Project detail card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Project details</CardTitle>
              <CardDescription>Key metadata for this project.</CardDescription>
            </div>
            {projectStatusBadge(project.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Project code</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{project.projectCode ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">Start date</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-xs font-normal uppercase tracking-wide text-[#374151]">End date</p>
              <p className="mt-1 text-sm text-[#111827] tracking-[-0.42px]">{formatDate(project.endDate)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sites card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sites</CardTitle>
          <CardDescription>
            {sites.length} site{sites.length !== 1 ? "s" : ""} on this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {canEdit && (
            <CreateSiteForm
              orgId={orgId}
              contractId={contractId}
              projectId={projectId}
            />
          )}

          {sites.length === 0 ? (
            <EmptyState message="No sites yet. Create one above to get started." />
          ) : (
            <div className="rounded-[14px] border border-[#E5E7EB] overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f9fafb]">
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Name</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Site code</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Postcode</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">City</TableHead>
                    <TableHead className="text-xs font-normal text-[#374151] tracking-[-0.36px]">Country</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id} className="hover:bg-[#f9fafb]">
                      <TableCell className="font-normal text-[#111827] tracking-[-0.42px]">
                        {site.name}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {site.siteCode ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {site.postcode ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {site.city ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-[#374151] tracking-[-0.42px]">
                        {site.country ?? "—"}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <DeleteSiteButton
                            orgId={orgId}
                            contractId={contractId}
                            projectId={projectId}
                            siteId={site.id}
                            name={site.name}
                          />
                        )}
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
          You do not have permission to view this project.
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
