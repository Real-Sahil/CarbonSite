import { AuthError, requireOrgMember } from "@/lib/auth/session";
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
import type { ReviewTaskStatus, ReviewTaskType } from "@prisma/client";

interface Props {
  params: Promise<{ orgId: string }>;
}

function statusBadge(status: ReviewTaskStatus) {
  switch (status) {
    case "open":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Open</Badge>;
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
      return `/orgs/${orgId}/imports/${targetId}`;
    case "activity_record":
      return `/orgs/${orgId}/records/${targetId}`;
    case "report":
      return `/orgs/${orgId}/reports/${targetId}`;
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
    await requireOrgMember(
      orgId,
      "admin",
      "sustainability_director",
      "sustainability_manager",
      "operations_manager",
      "editor",
      "reviewer",
    );
  } catch (err) {
    if (err instanceof AuthError) {
      if (err.status === 401) redirect("/sign-in");
      return <AccessDenied />;
    }
    throw err;
  }

  const tasks = await prisma.reviewTask.findMany({
    where: { organizationId: orgId },
    include: {
      assignee: { select: { name: true, email: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const grouped = new Map<ReviewTaskStatus, typeof tasks>();
  for (const status of STATUS_ORDER) {
    grouped.set(status, []);
  }
  for (const task of tasks) {
    const bucket = grouped.get(task.status);
    if (bucket) bucket.push(task);
  }

  return (
    <div className="p-[42px] max-w-[1200px] mx-auto flex flex-col gap-[42px]">
      <div>
        <p className="text-xs font-normal tracking-[-0.36px] text-[#0f3e17] bg-[#b6ced5] rounded-full px-[14px] py-[7px] inline-flex mb-[14px]">
          Operations
        </p>
        <h1
          className="text-[40px] leading-[1.35] tracking-[-0.4px] text-[#0f3e17]"
          style={{ fontFamily: "var(--font-fraunces, Fraunces, Georgia, serif)", fontWeight: 300 }}
        >
          Review queue
        </h1>
        <p className="text-sm text-[#222222] font-normal tracking-[-0.42px] mt-[7px]">
          All review tasks across imports, records, and reports for this organisation.
        </p>
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-[42px] text-center">
            <p className="text-sm text-[#222222] tracking-[-0.42px]">No review tasks yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {STATUS_ORDER.map((status) => {
            const bucket = grouped.get(status) ?? [];
            if (bucket.length === 0) return null;
            return (
              <Card key={status}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base capitalize">{status.replace("_", " ")}</CardTitle>
                    <Badge variant="outline">{bucket.length}</Badge>
                  </div>
                  <CardDescription>
                    {status === "open" && "Tasks awaiting action."}
                    {status === "completed" && "Tasks that have been resolved."}
                    {status === "blocked" && "Tasks blocked pending external input."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-[14px] border border-[#e5e7eb] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#f9fafb]">
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Type</TableHead>
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Target</TableHead>
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Assigned to</TableHead>
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Created by</TableHead>
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Age</TableHead>
                          <TableHead className="text-xs font-normal text-[#333333] tracking-[-0.36px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bucket.map((task) => (
                          <TableRow key={task.id} className="hover:bg-[#f9fafb]">
                            <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                              {typeLabel(task.type)}
                            </TableCell>
                            <TableCell className="font-normal text-[#0f3e17] tracking-[-0.42px]">
                              <Link
                                href={targetLink(orgId, task.type, task.targetId)}
                                className="hover:underline"
                              >
                                {task.targetId.slice(0, 8)}…
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                              {task.assignee.name ?? task.assignee.email}
                            </TableCell>
                            <TableCell className="text-sm text-[#222222] tracking-[-0.42px]">
                              {task.createdBy.name ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-[#333333] tracking-[-0.42px]">
                              {formatAge(task.createdAt)}
                            </TableCell>
                            <TableCell>
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
          You do not have permission to view the review queue.
        </p>
      </div>
    </div>
  );
}
