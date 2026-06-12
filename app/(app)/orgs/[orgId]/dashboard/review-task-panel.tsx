"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Plus } from "lucide-react";

export interface ReviewTaskPanelCandidate {
  key: string;
  type: string;
  targetId: string;
  label: string;
  detail: string;
  href: string;
}

interface ReviewTask {
  id: string;
  type: string;
  status: string;
  label: string;
  detail: string;
  href: string;
  assigneeLabel: string;
  createdByLabel: string;
  createdAt: string;
}

interface ReviewTaskPanelProps {
  orgId: string;
  tasks: ReviewTask[];
  candidates: ReviewTaskPanelCandidate[];
  assignees: { id: string; label: string }[];
  defaultAssigneeId: string;
}

export function ReviewTaskPanel({
  orgId,
  tasks,
  candidates,
  assignees,
  defaultAssigneeId,
}: ReviewTaskPanelProps) {
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [selectedCandidate, setSelectedCandidate] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleClose(taskId: string) {
    setLoading(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/review-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (res.ok) {
        setClosedIds((prev) => new Set([...prev, taskId]));
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to close task.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleAssign() {
    if (!selectedCandidate || !assigneeId) return;
    const candidate = candidates.find((c) => c.key === selectedCandidate);
    if (!candidate) return;
    setLoading("new");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/review-tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: candidate.type,
          targetId: candidate.targetId,
          assigneeUserId: assigneeId,
        }),
      });
      if (res.ok) {
        setSelectedCandidate("");
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to create task.");
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(null);
    }
  }

  const visibleTasks = tasks.filter((t) => !closedIds.has(t.id));

  return (
    <div className="space-y-4">
      {candidates.length > 0 && assignees.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#e5e7eb] p-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#333333] tracking-[-0.36px]">Assign item</label>
            <Select value={selectedCandidate} onValueChange={setSelectedCandidate}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select item to assign" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#333333] tracking-[-0.36px]">Assignee</label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAssign}
            disabled={!selectedCandidate || loading === "new"}
            size="sm"
            variant="outline"
            className="gap-1.5"
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            {loading === "new" ? "Assigning…" : "Assign task"}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 tracking-[-0.42px]">{error}</p>}

      {visibleTasks.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-[#b1dbb8] bg-[#e1f4df] p-[21px]">
          <p className="font-normal text-[#0f3e17] tracking-[-0.42px]">No open review tasks</p>
          <p className="mt-1 text-sm text-[#222222] tracking-[-0.42px]">
            Assign items above to create tasks for reviewers.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#e5e7eb] rounded-[14px] border border-[#e5e7eb]">
          {visibleTasks.map((task) => (
            <div key={task.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  href={task.href}
                  className="text-sm font-normal text-[#0f3e17] hover:underline underline-offset-2 tracking-[-0.42px]"
                >
                  {task.label}
                </Link>
                <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">{task.detail}</p>
                <p className="mt-0.5 text-xs text-[#333333] tracking-[-0.36px]">
                  Assigned to {task.assigneeLabel} · {task.createdAt}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{task.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleClose(task.id)}
                  disabled={loading === task.id}
                  className="h-7 w-7 p-0"
                  title="Close task"
                >
                  <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-[#0f3e17]" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
