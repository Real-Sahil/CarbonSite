export const dynamic = "force-dynamic";

import { AuthError, requireOrgMember, ROLE_GROUPS } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckSquare } from "lucide-react";
import type { ReviewTaskStatus, ReviewTaskType } from "@prisma/client";

interface Props {
  params: Promise<{ orgId: string }>;
}

function statusBadge(status: ReviewTaskStatus) {
  switch (status) {
    case "open":
      return <Badge className="bg-[#F9FAFC] text-[#131d29] border-[#E3E8EE] hover:bg-[#FFF2EC]">Open</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Completed</Badge>;
    case "blocked":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">Blocked</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function targetLink(orgId: string, type: ReviewTaskType, targetId: string): string {
  switch (type) {
    case "import_batch":
      // No per-batch detail page exists — land on the imports list.
      return `/orgs/${orgId}/imports`;
    case "activity_record":
      return `/orgs/${orgId}/records/${targetId}`;
    case "field_submission":
      return `/orgs/${orgId}/submissions/${targetId}`;
    case "report":
      // No per-report detail page exists — land on the reports list.
      return `/orgs/${orgId}/reports`;
    default:
      return `/orgs/${orgId}/dashboard`;
  }
}

function typeLabel(type: ReviewTaskType): string {
  switch (type) {
    case "import_batch":
      return "Import batch";
    case "activity_record":
      return "Activity record";
    case "field_submission":
      return "Field submission";
    case "report":
      return "Report";
    default:
      return type;
  }
}

function formatAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

const STATUS_ORDER: ReviewTaskStatus[] = ["open", "blocked", "completed"];

export default async function TasksPage({ params }: Props) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId, ...ROLE_GROUPS.anyMember);
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    return (
      <div className="p-8">
        <p className="text-red-600 text-sm">
          Failed to load page. The database may be updating — try refreshing in a moment.
        </p>
      </div>
    );
  }

  const tasks = await prisma.reviewTask.findMany({
    where: { organizationId: orgId },
    include: {
      assignee: { select: { name: true, email: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  }).catch(() => null);

  if (!tasks) {
    return (
      <div className="p-8"><p className="text-red-600 text-sm">Failed to load tasks. The database may be updating — try refreshing in a moment.</p></div>
    );
  }

  const grouped = new Map<ReviewTaskStatus, typeof tasks>();
  for (const status of STATUS_ORDER) {
    grouped.set(status, []);
  }
  for (const task of tasks) {
    const bucket = grouped.get(task.status);
    if (bucket) bucket.push(task);
  }

  return (
    <div className="min-h-[100dvh] bg-[#F9FAFC]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E3E8EE]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF7ED]">
              <CheckSquare className="h-4 w-4 text-[#131d29]" />
            </div>
            <span className="text-xs font-medium tracking-wide text-[#131d29] uppercase">
              Operations
            </span>
          </div>
          <h1 className="text-2xl tracking-tight text-[#131d29]">
            Review queue
          </h1>
          <p className="mt-1 text-sm text-[#41505F] max-w-[65ch]">
            All review tasks across imports, records, and reports for this organisation.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {tasks.length === 0 ? (
          <Card className="border-[#E3E8EE] shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF7ED] mb-5">
                <CheckSquare className="h-7 w-7 text-[#131d29]" />
              </div>
              <p className="text-base font-semibold text-[#131d29] mb-2">No review tasks yet</p>
              <p className="text-sm text-[#41505F] max-w-sm">
                Tasks are created automatically when imports, records, or reports require review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {STATUS_ORDER.map((status) => {
              const bucket = grouped.get(status) ?? [];
              if (bucket.length === 0) return null;
              return (
                <Card key={status} className="border-[#E3E8EE] shadow-none">
                  <CardHeader className="px-6 py-4 border-b border-[#E3E8EE]">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm font-semibold text-[#131d29] capitalize">
                        {status.replace("_", " ")}
                      </CardTitle>
                      <Badge variant="outline" className="text-xs font-normal text-[#5B6A78] border-[#E3E8EE]">
                        {bucket.length}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-[#5B6A78] mt-0.5">
                      {status === "open" && "Tasks awaiting action."}
                      {status === "completed" && "Tasks that have been resolved."}
                      {status === "blocked" && "Tasks blocked pending external input."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#F9FAFC] border-b border-[#E3E8EE]">
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3 pl-6">Type</TableHead>
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Target</TableHead>
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Assigned to</TableHead>
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Created by</TableHead>
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3">Age</TableHead>
                            <TableHead className="text-xs font-medium text-[#5B6A78] py-3 pr-6">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bucket.map((task) => (
                            <TableRow key={task.id} className="border-b border-[#E3E8EE] hover:bg-[#F9FAFC] transition-colors">
                              <TableCell className="text-sm text-[#41505F] py-3.5 pl-6">
                                {typeLabel(task.type)}
                              </TableCell>
                              <TableCell className="text-sm font-medium text-[#131d29] py-3.5">
                                <Link
                                  href={targetLink(orgId, task.type, task.targetId)}
                                  className="hover:underline underline-offset-2"
                                >
                                  {task.targetId.slice(0, 8)}...
                                </Link>
                              </TableCell>
                              <TableCell className="text-sm text-[#41505F] py-3.5">
                                {task.assignee.name ?? task.assignee.email}
                              </TableCell>
                              <TableCell className="text-sm text-[#5B6A78] py-3.5">
                                {task.createdBy.name ?? "-"}
                              </TableCell>
                              <TableCell className="text-sm text-[#5B6A78] py-3.5">
                                {formatAge(task.createdAt)}
                              </TableCell>
                              <TableCell className="py-3.5 pr-6">
                                {statusBadge(task.status)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="p-8">
      <p className="text-sm text-red-600">You do not have permission to view the review queue.</p>
    </div>
  );
}
