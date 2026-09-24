export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import type { OrgRole } from "@prisma/client";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { CreateCommitmentButton } from "./commitments-actions";

interface Props {
  params: Promise<{ orgId: string }>;
}

const VIEW_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "contract_manager",
  "editor",
  "reviewer",
  "viewer",
  "auditor",
];

const EDIT_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "contract_manager",
];

function formatGbp(n: number | null) {
  if (n == null) return null;
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  active: "Active",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "secondary",
  in_progress: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export default async function CommitmentsPage({ params }: Props) {
  const { orgId } = await params;

  let role: OrgRole;
  try {
    const result = await requireOrgMember(orgId, ...VIEW_ROLES);
    role = result.membership.role;
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const canEdit = EDIT_ROLES.includes(role);

  const [commitments, contracts, periods, frameworks] = await Promise.all([
    prisma.svCommitment.findMany({
      where: { organizationId: orgId },
      include: {
        contract: { select: { id: true, name: true } },
        framework: { select: { id: true, name: true, slug: true } },
        owner: { select: { id: true, name: true } },
        reportingPeriod: { select: { id: true, label: true } },
        _count: { select: { activities: true } },
        activities: {
          where: { status: "approved" },
          select: { monetisedValue: true },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.contract.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.reportingPeriod.findMany({
      where: { organizationId: orgId },
      select: { id: true, label: true },
      orderBy: [{ startDate: "desc" }],
    }),
    prisma.svFramework.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const commitmentsWithProgress = commitments.map((c) => {
    const approvedMonetised = c.activities.reduce(
      (sum, a) => sum + (a.monetisedValue ? Number(a.monetisedValue) : 0),
      0,
    );
    const progressPct =
      c.monetisedValue && Number(c.monetisedValue) > 0
        ? Math.min(100, Math.round((approvedMonetised / Number(c.monetisedValue)) * 100))
        : null;
    return { ...c, approvedMonetised, progressPct };
  });

  const totalActive = commitments.filter((c) => c.status === "active" || c.status === "in_progress").length;
  const totalCompleted = commitments.filter((c) => c.status === "completed").length;

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
              <ClipboardList className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Social Value
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Commitments</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Social value commitments linked to contracts, frameworks, and reporting periods.
              </p>
            </div>
            {canEdit && (
              <CreateCommitmentButton
                orgId={orgId}
                contracts={contracts}
                periods={periods}
                frameworks={frameworks}
              />
            )}
          </div>

          {commitments.length > 0 && (
            <div className="mt-6 flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Active</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">{totalActive}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Completed</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">{totalCompleted}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Total</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">{commitments.length}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              All commitments
              <span className="ml-2 text-xs font-normal text-[#6B7280]">({commitments.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#6B7280] mt-0.5">
              Up to 100 commitments shown, ordered by status then date.
            </CardDescription>
          </CardHeader>
          <CardContent className={commitments.length === 0 ? "pb-8" : "p-0"}>
            {commitments.length === 0 ? (
              <EmptyState orgId={orgId} canEdit={canEdit} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pl-6">Commitment</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Contract</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Framework</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Period</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 text-right">Target</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 text-right">Delivered</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pr-6">Activities</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commitmentsWithProgress.map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                      >
                        <TableCell className="py-3.5 pl-6 max-w-[260px]">
                          <Link
                            href={`/orgs/${orgId}/social-value/commitments/${c.id}`}
                            className="text-sm font-medium text-[#111827] hover:underline truncate block"
                          >
                            {c.title}
                          </Link>
                          {c.owner && (
                            <span className="text-xs text-[#6B7280]">{c.owner.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {c.contract?.name ?? <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {c.framework?.name ?? <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {c.reportingPeriod?.label ?? <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={STATUS_VARIANTS[c.status] ?? "outline"} className="text-xs">
                            {STATUS_LABELS[c.status] ?? c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-[#374151] py-3.5">
                          {c.monetisedValue != null
                            ? formatGbp(Number(c.monetisedValue))
                            : c.targetValue != null
                            ? `${Number(c.targetValue).toLocaleString("en-GB")} ${c.targetUnit ?? ""}`
                            : <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          {c.progressPct != null ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-sm font-semibold text-[#111827] tabular-nums">
                                {formatGbp(c.approvedMonetised)}
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-[#c2410c]"
                                    style={{ width: `${c.progressPct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-[#6B7280] tabular-nums">{c.progressPct}%</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[#6B7280]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 pr-6">
                          <Link
                            href={`/orgs/${orgId}/social-value/activities?commitmentId=${c.id}`}
                            className="text-sm text-[#374151] hover:underline tabular-nums"
                          >
                            {c._count.activities}
                          </Link>
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

function EmptyState({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7ED]">
        <ClipboardList className="h-7 w-7 text-[#111827]" />
      </div>
      <div>
        <p className="font-normal text-[#111827] tracking-[-0.42px]">No commitments yet</p>
        <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">
          {canEdit
            ? "Create your first social value commitment to start tracking delivery against contracts."
            : "No social value commitments have been created for this organisation yet."}
        </p>
      </div>
      {canEdit && (
        <Link
          href={`/orgs/${orgId}/social-value/frameworks`}
          className="text-sm text-[#c2410c] hover:underline"
        >
          Set up a framework first
        </Link>
      )}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view social value commitments.</p>
    </div>
  );
}
