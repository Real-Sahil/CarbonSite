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
import { ListChecks } from "lucide-react";
import { CreateActivityButton, ReviewActivityButton } from "./activities-actions";

interface Props {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ commitmentId?: string; status?: string }>;
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

const SUBMIT_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
  "contract_manager",
  "editor",
];

const REVIEW_ROLES: OrgRole[] = [
  "admin",
  "sustainability_director",
  "sustainability_manager",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  under_review: "default",
  approved: "secondary",
  rejected: "destructive",
};

function formatGbp(n: number | null) {
  if (n == null) return null;
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default async function ActivitiesPage({ params, searchParams }: Props) {
  const { orgId } = await params;
  const { commitmentId, status } = await searchParams;

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

  const canSubmit = SUBMIT_ROLES.includes(role);
  const canReview = REVIEW_ROLES.includes(role);

  const where = {
    organizationId: orgId,
    ...(commitmentId && { commitmentId }),
    ...(status && { status: status as "draft" | "submitted" | "under_review" | "approved" | "rejected" }),
  };

  const [activities, commitments] = await Promise.all([
    prisma.svActivity.findMany({
      where,
      include: {
        commitment: { select: { id: true, title: true } },
        submittedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        facility: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { activityDate: "desc" }],
      take: 100,
    }),
    prisma.svCommitment.findMany({
      where: { organizationId: orgId, status: { in: ["active", "in_progress", "draft"] } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const approvedCount = activities.filter((a) => a.status === "approved").length;
  const pendingCount = activities.filter((a) => a.status === "submitted" || a.status === "under_review").length;
  const totalApprovedMonetised = activities
    .filter((a) => a.status === "approved" && a.monetisedValue)
    .reduce((sum, a) => sum + Number(a.monetisedValue), 0);

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
              <ListChecks className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Social Value
            </span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Activities</h1>
              <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
                Social value activities submitted against commitments.
                {commitmentId && " Filtered by commitment."}
              </p>
            </div>
            {canSubmit && (
              <CreateActivityButton orgId={orgId} commitments={commitments} />
            )}
          </div>

          {activities.length > 0 && (
            <div className="mt-6 flex gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Pending review</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">{pendingCount}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Approved</span>
                <span className="text-xl font-bold text-[#111827] tabular-nums">{approvedCount}</span>
              </div>
              {totalApprovedMonetised > 0 && (
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[#6B7280] uppercase tracking-wide font-medium">Approved value</span>
                  <span className="text-xl font-bold text-[#111827] tabular-nums">
                    {formatGbp(totalApprovedMonetised)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
        {/* Filter strip */}
        {(commitmentId || status) && (
          <div className="mb-4 flex items-center gap-2 text-xs text-[#6B7280]">
            <span>Filters active:</span>
            {commitmentId && (
              <Badge variant="outline" className="text-xs gap-1">
                Commitment
                <Link href={`/orgs/${orgId}/social-value/activities${status ? `?status=${status}` : ""}`} className="ml-1 hover:text-red-600">x</Link>
              </Badge>
            )}
            {status && (
              <Badge variant="outline" className="text-xs gap-1">
                {STATUS_LABELS[status] ?? status}
                <Link href={`/orgs/${orgId}/social-value/activities${commitmentId ? `?commitmentId=${commitmentId}` : ""}`} className="ml-1 hover:text-red-600">x</Link>
              </Badge>
            )}
            <Link href={`/orgs/${orgId}/social-value/activities`} className="text-[#6B7280] hover:text-[#374151] underline ml-2">
              Clear all
            </Link>
          </div>
        )}

        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">
              Activities
              <span className="ml-2 text-xs font-normal text-[#6B7280]">({activities.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#6B7280] mt-0.5">
              Up to 100 activities shown.
            </CardDescription>
          </CardHeader>
          <CardContent className={activities.length === 0 ? "pb-8" : "p-0"}>
            {activities.length === 0 ? (
              <EmptyState canSubmit={canSubmit} />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 pl-6">Activity</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Commitment</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Date</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Status</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 text-right">Quantity</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3 text-right">Value</TableHead>
                      <TableHead className="text-xs font-medium text-[#6B7280] py-3">Submitted by</TableHead>
                      {canReview && <TableHead className="text-xs font-medium text-[#6B7280] py-3 pr-6" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a) => (
                      <TableRow key={a.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <TableCell className="py-3.5 pl-6 max-w-[240px]">
                          <span className="text-sm font-medium text-[#111827] truncate block">{a.title}</span>
                          {a.facility && (
                            <span className="text-xs text-[#6B7280]">{a.facility.name}</span>
                          )}
                          {a.aiExtracted && (
                            <span className="text-xs text-[#6366f1] font-medium">AI extracted</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {a.commitment ? (
                            <Link
                              href={`/orgs/${orgId}/social-value/commitments/${a.commitment.id}`}
                              className="hover:underline truncate block max-w-[180px]"
                            >
                              {a.commitment.title}
                            </Link>
                          ) : (
                            <span className="text-[#6B7280]">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-[#6B7280] tabular-nums py-3.5">
                          {new Date(a.activityDate).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <Badge variant={STATUS_VARIANTS[a.status] ?? "outline"} className="text-xs">
                            {STATUS_LABELS[a.status] ?? a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums text-[#374151] py-3.5">
                          {a.quantityValue != null
                            ? `${Number(a.quantityValue).toLocaleString("en-GB")} ${a.quantityUnit ?? ""}`
                            : <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-[#111827] tabular-nums py-3.5">
                          {a.monetisedValue != null
                            ? formatGbp(Number(a.monetisedValue))
                            : <span className="font-normal text-[#6B7280]">-</span>}
                        </TableCell>
                        <TableCell className="text-sm text-[#374151] py-3.5">
                          {a.submittedBy?.name ?? <span className="text-[#6B7280]">-</span>}
                        </TableCell>
                        {canReview && (
                          <TableCell className="py-3.5 pr-6">
                            {(a.status === "submitted" || a.status === "under_review") && (
                              <ReviewActivityButton orgId={orgId} activityId={a.id} title={a.title} />
                            )}
                          </TableCell>
                        )}
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

function EmptyState({ canSubmit }: { canSubmit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF7ED]">
        <ListChecks className="h-7 w-7 text-[#111827]" />
      </div>
      <div>
        <p className="font-normal text-[#111827] tracking-[-0.42px]">No activities yet</p>
        <p className="text-sm text-[#374151] tracking-[-0.42px] mt-[7px] max-w-sm">
          {canSubmit
            ? "Log your first social value activity to record delivery against a commitment."
            : "No activities have been logged for this organisation yet."}
        </p>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view social value activities.</p>
    </div>
  );
}
