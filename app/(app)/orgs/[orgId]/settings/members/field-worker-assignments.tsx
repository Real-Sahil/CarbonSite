"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface WorkerOption {
  id: string;
  label: string;
  email: string;
}

interface PeriodOption {
  id: string;
  label: string;
  status: string;
  startDate: string;
  endDate: string;
}

interface FacilityOption {
  id: string;
  name: string;
}

interface AssignmentRow {
  id: string;
  userId: string;
  workerLabel: string;
  workerEmail: string;
  reportingPeriodId: string;
  reportingPeriodLabel: string;
  facilityName: string | null;
  assignedByLabel: string;
  createdAt: string;
}

interface FieldWorkerAssignmentsProps {
  orgId: string;
  assignmentsAvailable: boolean;
  workers: WorkerOption[];
  periods: PeriodOption[];
  facilities: FacilityOption[];
  assignments: AssignmentRow[];
}

export function FieldWorkerAssignments({
  orgId,
  assignmentsAvailable,
  workers,
  periods,
  facilities,
  assignments,
}: FieldWorkerAssignmentsProps) {
  const router = useRouter();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [facilityId, setFacilityId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const assignedPeriodIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.userId === workerId)
          .map((assignment) => assignment.reportingPeriodId),
      ),
    [assignments, workerId],
  );
  const hasSetup = workers.length > 0 && periods.length > 0;
  const canAssign = assignmentsAvailable && hasSetup;

  function assignWorker(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!workerId || !periodId) {
      setError("Choose a field worker and reporting period.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/orgs/${orgId}/field-worker-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: workerId,
          reportingPeriodId: periodId,
          facilityId,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not assign field worker.");
        return;
      }

      setSuccess("Mobile project assignment saved.");
      setFacilityId("");
      router.refresh();
    });
  }

  function removeAssignment(assignment: AssignmentRow) {
    const confirmed = window.confirm(
      `Remove ${assignment.workerLabel}'s access to ${assignment.reportingPeriodLabel}?`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    startTransition(async () => {
      const response = await fetch(
        `/api/orgs/${orgId}/field-worker-assignments/${assignment.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not remove assignment.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <form onSubmit={assignWorker} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
              <UserRoundCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Assign mobile access</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Field workers only see assigned reporting periods in the mobile app.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="field-worker-user">Mobile user</Label>
              <select
                id="field-worker-user"
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
            disabled={isPending || !assignmentsAvailable || workers.length === 0}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                {workers.length === 0 ? (
                  <option value="">No field workers yet</option>
                ) : (
                  workers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.label} - {worker.email}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="field-worker-period">Project / reporting period</Label>
              <select
                id="field-worker-period"
                value={periodId}
                onChange={(event) => setPeriodId(event.target.value)}
                disabled={isPending || !assignmentsAvailable || periods.length === 0}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                {periods.length === 0 ? (
                  <option value="">No reporting periods</option>
                ) : (
                  periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.label}
                      {assignedPeriodIds.has(period.id) ? " (assigned)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="field-worker-facility">Site / facility scope</Label>
              <select
                id="field-worker-facility"
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                disabled={isPending || !assignmentsAvailable}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                <option value="">All sites in this reporting period</option>
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" disabled={isPending || !canAssign}>
              {isPending ? "Saving..." : "Save assignment"}
            </Button>
          </div>
          {!assignmentsAvailable && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Mobile assignment storage is not ready yet. Apply the latest Prisma
              migration, then refresh this page.
            </p>
          )}
          {!hasSetup && (
            <p className="mt-3 text-sm text-slate-500">
              Invite a Field Worker and create a reporting period before assigning mobile access.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
        </form>

        <div className="rounded-lg border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Current mobile assignments</p>
          </div>
          {assignments.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-slate-500">
              No field workers have project access yet. Assigned projects appear in the mobile app after the user accepts their invite.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{assignment.workerLabel}</p>
                      <Badge variant="outline">Mobile</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{assignment.workerEmail}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {assignment.reportingPeriodLabel}
                      {assignment.facilityName ? ` - ${assignment.facilityName}` : " - all sites"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Assigned by {assignment.assignedByLabel} on{" "}
                      {new Date(assignment.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    title="Remove assignment"
                    disabled={isPending}
                    onClick={() => removeAssignment(assignment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
