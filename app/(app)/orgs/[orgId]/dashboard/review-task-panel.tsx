"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight, Check, CircleAlert, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type ReviewTaskStatus = "open" | "completed" | "blocked";
type ReviewTaskType = "import_batch" | "activity_record" | "report";

export type ReviewTaskPanelTask = {
  id: string;
  type: ReviewTaskType;
  status: ReviewTaskStatus;
  label: string;
  detail: string;
  href: string;
  assigneeLabel: string;
  createdByLabel: string;
  createdAt: string;
};

export type ReviewTaskPanelCandidate = {
  key: string;
  type: ReviewTaskType;
  targetId: string;
  label: string;
  detail: string;
  href: string;
};

export type ReviewTaskPanelAssignee = {
  id: string;
  label: string;
};

export function ReviewTaskPanel({
  orgId,
  tasks,
  candidates,
  assignees,
  defaultAssigneeId,
}: {
  orgId: string;
  tasks: ReviewTaskPanelTask[];
  candidates: ReviewTaskPanelCandidate[];
  assignees: ReviewTaskPanelAssignee[];
  defaultAssigneeId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigneeByTarget, setAssigneeByTarget] = useState<Record<string, string>>({});

  const assignTask = (candidate: ReviewTaskPanelCandidate) => {
    const assigneeUserId = assigneeByTarget[candidate.key] ?? defaultAssigneeId;
    setPendingKey(candidate.key);
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/orgs/${orgId}/review-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: candidate.type,
          targetId: candidate.targetId,
          assigneeUserId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not assign review task");
        setPendingKey(null);
        return;
      }
      router.refresh();
      setPendingKey(null);
    });
  };

  const updateTask = (taskId: string, status: ReviewTaskStatus) => {
    setPendingKey(taskId);
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/orgs/${orgId}/review-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not update review task");
        setPendingKey(null);
        return;
      }
      router.refresh();
      setPendingKey(null);
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">My review tasks</h3>
          <p className="mt-1 text-xs text-slate-500">
            Assigned tenant work that needs a recorded outcome.
          </p>
        </div>
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-800">No open tasks assigned to you</p>
            <p className="mt-1 text-xs text-slate-500">
              New import, record, and report reviews appear here when assigned.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {tasks.map((task) => (
              <div key={task.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{task.label}</p>
                      <Badge variant="outline">{task.type.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{task.detail}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Assigned by {task.createdByLabel} on {task.createdAt}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={task.href} title="Open source workflow">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateTask(task.id, "completed")}
                    disabled={isPending && pendingKey === task.id}
                  >
                    <Check className="h-4 w-4" />
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateTask(task.id, "blocked")}
                    disabled={isPending && pendingKey === task.id}
                  >
                    <CircleAlert className="h-4 w-4" />
                    Block
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Assign operational reviews</h3>
          <p className="mt-1 text-xs text-slate-500">
            Live exceptions from imports, records, and reports.
          </p>
        </div>
        {candidates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-800">No review candidates</p>
            <p className="mt-1 text-xs text-slate-500">
              Failed reports, import issues, and records in review will be assignable here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {candidates.map((candidate) => (
              <div key={candidate.key} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{candidate.label}</p>
                      <Badge variant="outline">{candidate.type.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{candidate.detail}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={candidate.href} title="Open source workflow">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    aria-label="Assignee"
                    className="h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 sm:flex-1"
                    value={assigneeByTarget[candidate.key] ?? defaultAssigneeId}
                    onChange={(event) =>
                      setAssigneeByTarget((current) => ({
                        ...current,
                        [candidate.key]: event.target.value,
                      }))
                    }
                  >
                    {assignees.map((assignee) => (
                      <option key={assignee.id} value={assignee.id}>
                        {assignee.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={() => assignTask(candidate)}
                    disabled={assignees.length === 0 || (isPending && pendingKey === candidate.key)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
