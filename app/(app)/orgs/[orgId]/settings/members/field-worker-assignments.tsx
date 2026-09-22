"use client";

// Manages FieldWorkerSiteAssignment — the table the mobile app's /my-sites
// endpoint reads. A field worker with no site assignments sees zero projects
// in the app, so this panel is the org-wide-invite recovery path.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPinPlus, Trash2, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface WorkerOption {
  id: string;
  label: string;
  email: string;
}

interface SiteOption {
  id: string;
  name: string;
  projectName: string | null;
}

interface AssignmentRow {
  id: string;
  userId: string;
  workerLabel: string;
  workerEmail: string;
  siteId: string;
  siteLabel: string;
  assignedByLabel: string;
  createdAt: string;
}

interface FieldWorkerAssignmentsProps {
  orgId: string;
  assignmentsAvailable: boolean;
  workers: WorkerOption[];
  sites: SiteOption[];
  assignments: AssignmentRow[];
}

export function FieldWorkerAssignments({
  orgId,
  assignmentsAvailable,
  workers,
  sites,
  assignments,
}: FieldWorkerAssignmentsProps) {
  const router = useRouter();
  const [workerId, setWorkerId] = useState(workers[0]?.id ?? "");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [newSiteName, setNewSiteName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();
  const [siteFilter, setSiteFilter] = useState("all");

  function createSite() {
    const name = newSiteName.trim();
    if (!name) {
      setError("Enter a site name.");
      return;
    }
    setError("");
    setSuccess("");
    startTransition(async () => {
      const response = await fetch(`/api/orgs/${orgId}/sites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        if (response.status === 401) { window.location.href = "/sign-in"; return; }
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not create the site.");
        return;
      }
      const site = (await response.json()) as { id: string };
      setNewSiteName("");
      setSiteId(site.id);
      setSuccess(`Site "${name}" created — now grant a worker access to it.`);
      router.refresh();
    });
  }
  const assignedSiteIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.userId === workerId)
          .map((assignment) => assignment.siteId),
      ),
    [assignments, workerId],
  );
  const hasSetup = workers.length > 0 && sites.length > 0;
  const canAssign = assignmentsAvailable && hasSetup;

  function assignWorker(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!workerId || !siteId) {
      setError("Choose a field worker and a site.");
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/orgs/${orgId}/field-worker-site-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: workerId, siteId }),
      });

      if (!response.ok) {
        if (response.status === 401) { window.location.href = "/sign-in"; return; }
        const body = await response.json().catch(() => null);
        setError(body?.message ?? "Could not assign field worker.");
        return;
      }

      setSuccess("Site access saved — it appears in the worker's app immediately.");
      router.refresh();
    });
  }

  function removeAssignment(assignment: AssignmentRow) {
    const confirmed = window.confirm(
      `Remove ${assignment.workerLabel}'s access to ${assignment.siteLabel}?`,
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    startTransition(async () => {
      const response = await fetch(
        `/api/orgs/${orgId}/field-worker-site-assignments/${assignment.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        if (response.status === 401) { window.location.href = "/sign-in"; return; }
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
              <p className="text-sm font-semibold text-slate-900">Assign site access</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Field workers only see assigned sites in the mobile app. Workers who
                joined with an org-wide invite have no sites until you assign one here.
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
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
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
              <Label htmlFor="field-worker-site">Site</Label>
              <select
                id="field-worker-site"
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                disabled={isPending || !assignmentsAvailable || sites.length === 0}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm"
              >
                {sites.length === 0 ? (
                  <option value="">No sites yet — create one below</option>
                ) : (
                  sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.projectName ? `${site.projectName} — ${site.name}` : site.name}
                      {assignedSiteIds.has(site.id) ? " (assigned)" : ""}
                    </option>
                  ))
                )}
              </select>
            </div>

            <Button type="submit" disabled={isPending || !canAssign}>
              {isPending ? "Saving..." : "Grant site access"}
            </Button>

            {/* Quick site creation — Site requires a Contract → Project chain
                that new orgs don't have yet; this provisions a default pair
                so the field workflow isn't blocked on full setup. */}
            <div className="mt-2 border-t border-slate-200 pt-3">
              <Label htmlFor="quick-site-name" className="flex items-center gap-1.5">
                <MapPinPlus className="h-3.5 w-3.5 text-slate-500" />
                New site
              </Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  id="quick-site-name"
                  value={newSiteName}
                  onChange={(event) => setNewSiteName(event.target.value)}
                  placeholder="e.g. Riverside Depot"
                  disabled={isPending}
                  className="h-9"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={isPending || newSiteName.trim().length === 0}
                  onClick={createSite}
                >
                  Create site
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Filed under a default &quot;General&quot; contract — reorganise
                later from the Contracts page.
              </p>
            </div>
          </div>
          {!assignmentsAvailable && (
            <p className="mt-3 rounded-[7px] border border-[#E5E7EB] bg-[#FFF7ED] px-3 py-2 text-sm text-[#111827] tracking-[-0.42px]">
              Mobile assignment setup is incomplete. Contact your administrator
              to apply the latest database update, then refresh this page.
            </p>
          )}
          {!hasSetup && (
            <p className="mt-3 text-sm text-slate-500">
              Invite a Field Worker and create a contract, project, and site before
              assigning mobile access.
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-3 text-sm text-green-700">{success}</p>}
        </form>

        <div className="rounded-lg border border-slate-200 flex flex-col min-w-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Current site access</p>
          </div>
          {assignments.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-slate-500">
              No field workers have site access yet. Site-scoped invite links grant
              access automatically; org-wide invites need a manual assignment here.
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {/* Site filter chips */}
              {(() => {
                const uniqueSites = [...new Map(assignments.map((a) => [a.siteId, a.siteLabel])).entries()];
                return uniqueSites.length > 1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSiteFilter("all")}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        siteFilter === "all"
                          ? "bg-[#0F766E] text-white border-[#0F766E]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      All ({assignments.length})
                    </button>
                    {uniqueSites.map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setSiteFilter(id)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          siteFilter === id
                            ? "bg-[#0F766E] text-white border-[#0F766E]"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        {label} ({assignments.filter((a) => a.siteId === id).length})
                      </button>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* Assignment cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assignments
                  .filter((a) => siteFilter === "all" || a.siteId === siteFilter)
                  .map((assignment) => {
                    const initial = assignment.workerLabel[0]?.toUpperCase() ?? "?";
                    return (
                      <div
                        key={assignment.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 min-w-0"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-[#CCFBF1] flex items-center justify-center text-[#0F766E] text-sm font-semibold shrink-0 select-none">
                            {initial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {assignment.workerLabel}
                              </p>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">Mobile</Badge>
                            </div>
                            <p className="text-xs text-slate-500 truncate">{assignment.workerEmail}</p>
                            <p className="mt-1 text-xs font-medium text-slate-700 truncate">{assignment.siteLabel}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              by {assignment.assignedByLabel} on{" "}
                              {new Date(assignment.createdAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title="Remove site access"
                            disabled={isPending}
                            onClick={() => removeAssignment(assignment)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
