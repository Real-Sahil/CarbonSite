export const dynamic = "force-dynamic";

import { requireOrgMember, AuthError } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { FieldSubmissionStatus } from "@prisma/client";
import { SubmissionsTable } from "./submissions-table";
import { ClipboardList } from "lucide-react";

interface SubmissionsPageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ status?: string; limit?: string }>;
}

const STATUS_FILTERS: { value: FieldSubmissionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "In review" },
  { value: "needs_info", label: "Needs info" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const PAGE_SIZE = 50;
const MAX_LIMIT = 500;

export default async function SubmissionsPage({
  params,
  searchParams,
}: SubmissionsPageProps) {
  const { orgId } = await params;
  const { status: rawStatus, limit: rawLimit } = await searchParams;

  const statusFilter = STATUS_FILTERS.some((f) => f.value === rawStatus)
    ? (rawStatus as FieldSubmissionStatus | "all")
    : "all";
  const limit = Math.min(
    Math.max(Number(rawLimit) || PAGE_SIZE, PAGE_SIZE),
    MAX_LIMIT,
  );

  let members: { id: string; name: string | null; email: string }[] = [];
  let initialSubmissions: {
    id: string;
    documentType: string;
    status: string;
    createdAt: string;
    submittedBy: { name: string | null; email: string };
    reportingPeriod: { label: string };
    facility: { name: string } | null;
    emissionCategoryId: string | null;
  }[] = [];
  let statusCounts = new Map<string, number>();
  let hasMore = false;
  let total = 0;

  try {
    await requireOrgMember(orgId, "admin", "editor", "reviewer");

    const where = {
      organizationId: orgId,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    };

    const [memberships, submissions, countRows] = await Promise.all([
      prisma.organizationMembership.findMany({
        where: { organizationId: orgId, role: { in: ["admin", "editor", "reviewer"] } },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.fieldSubmission.findMany({
        where,
        include: {
          submittedBy: { select: { name: true, email: true } },
          reportingPeriod: { select: { label: true } },
          facility: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      }),
      prisma.fieldSubmission.groupBy({
        by: ["status"],
        where: { organizationId: orgId },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
    ]);

    statusCounts = new Map(countRows.map((row) => [row.status, row._count._all]));
    total = countRows.reduce((sum, row) => sum + row._count._all, 0);
    hasMore = submissions.length > limit;
    const page = hasMore ? submissions.slice(0, limit) : submissions;

    members = memberships.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }));
    initialSubmissions = page.map((s) => ({
      id: s.id,
      documentType: s.documentType,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      submittedBy: { name: s.submittedBy.name, email: s.submittedBy.email },
      reportingPeriod: { label: s.reportingPeriod?.label ?? "" },
      facility: s.facility ? { name: s.facility.name } : null,
      emissionCategoryId: s.emissionCategoryId,
    }));
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return (
        <div className="p-8">
          <p className="text-red-600">
            You do not have permission to view submissions.
          </p>
        </div>
      );
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load submissions. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const filterHref = (value: string, nextLimit = PAGE_SIZE) =>
    `/orgs/${orgId}/submissions?${new URLSearchParams({
      ...(value !== "all" ? { status: value } : {}),
      ...(nextLimit !== PAGE_SIZE ? { limit: String(nextLimit) } : {}),
    }).toString()}`.replace(/\?$/, "");

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFB]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1200px] mx-auto px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fff7ed]">
              <ClipboardList className="h-4 w-4 text-[#111827]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">
              Review
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
            Field submissions
          </h1>
          <p className="mt-1 text-sm text-[#374151] max-w-[65ch]">
            Review incoming submissions from field workers before approving them as activity records.
          </p>

          {/* Status filter tabs */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => {
              const count =
                filter.value === "all" ? total : statusCounts.get(filter.value) ?? 0;
              const active = statusFilter === filter.value;
              return (
                <Link
                  key={filter.value}
                  href={filterHref(filter.value)}
                  className={`rounded-full px-3 py-1 text-xs font-normal transition-colors ${
                    active
                      ? "bg-[#f97316] text-white"
                      : "border border-[#E5E7EB] text-[#374151] hover:border-[#BAE6FD] hover:bg-[#fff7ed]"
                  }`}
                >
                  {filter.label}
                  <span className={`ml-1.5 ${active ? "text-[#BAE6FD]" : "text-[#9CA3AF]"}`}>
                    {count.toLocaleString("en-GB")}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <SubmissionsTable orgId={orgId} members={members} initialSubmissions={initialSubmissions} />

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Link
              href={filterHref(statusFilter, limit + PAGE_SIZE)}
              className="rounded-full border border-[#E5E7EB] px-4 py-2 text-sm text-[#374151] hover:border-[#BAE6FD] hover:bg-[#fff7ed] transition-colors"
            >
              Show more ({initialSubmissions.length.toLocaleString("en-GB")} of{" "}
              {(statusFilter === "all"
                ? total
                : statusCounts.get(statusFilter) ?? 0
              ).toLocaleString("en-GB")}
              )
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
