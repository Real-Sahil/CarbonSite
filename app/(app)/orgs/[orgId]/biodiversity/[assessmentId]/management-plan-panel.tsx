"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, CalendarClock } from "lucide-react";

interface MonitoringEvent {
  id: string;
  monitoringYear: number;
  dueOn: string;
  status: string;
  onTrack: boolean | null;
}

interface Plan {
  id: string;
  title: string;
  responsibleParty: string | null;
  commencesOn: string;
  endsOn: string;
  events: MonitoringEvent[];
}

export function ManagementPlanPanel({
  orgId,
  assessmentId,
  canManage,
  meetsRequirement,
  plan,
}: {
  orgId: string;
  assessmentId: string;
  canManage: boolean;
  meetsRequirement: boolean;
  plan: Plan | null;
}) {
  if (plan) {
    return <ExistingPlan plan={plan} />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Management and monitoring</CardTitle>
        <CardDescription>
          A net gain must be maintained and monitored for 30 years, secured through a planning
          obligation or a conservation covenant. Creating a plan generates the monitoring schedule.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!meetsRequirement ? (
          <p className="text-sm text-zinc-500">
            A management plan secures a net gain. This assessment does not deliver one yet, so
            there is nothing to secure.
          </p>
        ) : canManage ? (
          <CreatePlanForm orgId={orgId} assessmentId={assessmentId} />
        ) : (
          <p className="text-sm text-zinc-500">
            No management plan yet. Someone with edit rights needs to create one.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ExistingPlan({ plan }: { plan: Plan }) {
  const now = Date.now();
  const events = plan.events.map((e) => ({
    ...e,
    derived:
      e.status === "scheduled" && new Date(e.dueOn).getTime() < now ? "overdue" : e.status,
  }));

  const completed = events.filter((e) => e.status === "completed").length;
  const overdue = events.filter((e) => e.derived === "overdue").length;
  const remediation = events.filter((e) => e.status === "remediation_required").length;
  const yearsLeft = Math.max(
    0,
    Math.ceil((new Date(plan.endsOn).getTime() - now) / (365.25 * 86_400_000)),
  );

  return (
    <Card className={overdue > 0 || remediation > 0 ? "border-amber-200" : undefined}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{plan.title}</CardTitle>
            <CardDescription>
              {plan.responsibleParty ? `${plan.responsibleParty} · ` : ""}
              {fmtDate(plan.commencesOn)} to {fmtDate(plan.endsOn)}, {yearsLeft} years remaining
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {remediation > 0 && (
              <Badge className="bg-amber-100 text-xs text-amber-900 hover:bg-amber-100">
                {remediation} needing remediation
              </Badge>
            )}
            {overdue > 0 && (
              <Badge className="bg-red-100 text-xs text-red-900 hover:bg-red-100">
                {overdue} overdue
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {completed} of {events.length} done
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-wrap gap-2">
          {events.map((e) => (
            <div
              key={e.id}
              className={
                e.derived === "overdue"
                  ? "rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5"
                  : e.status === "remediation_required"
                    ? "rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
                    : e.status === "completed"
                      ? "rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5"
                      : "rounded-md border border-zinc-200 px-2.5 py-1.5"
              }
            >
              <div className="text-xs font-medium text-zinc-700">Year {e.monitoringYear}</div>
              <div className="font-mono text-xs tabular-nums text-zinc-500">
                {fmtDate(e.dueOn)}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
          <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Monitoring is front-loaded because created habitat fails early if it is going to fail,
          then drops to five-yearly once establishment is proven.
        </p>
      </CardContent>
    </Card>
  );
}

function CreatePlanForm({ orgId, assessmentId }: { orgId: string; assessmentId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [responsibleParty, setResponsibleParty] = useState("");
  const [commencesOn, setCommencesOn] = useState(new Date().toISOString().slice(0, 10));
  const [objectives, setObjectives] = useState("");
  const [prescriptions, setPrescriptions] = useState("");
  const [remediation, setRemediation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Give the plan a title.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/biodiversity/${assessmentId}/management-plan`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            ...(responsibleParty.trim() && { responsibleParty: responsibleParty.trim() }),
            commencesOn,
            ...(objectives.trim() && { managementObjectives: objectives.trim() }),
            ...(prescriptions.trim() && { prescriptions: prescriptions.trim() }),
            ...(remediation.trim() && { remediationStrategy: remediation.trim() }),
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not create the management plan.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="mp-title" className="block text-sm font-medium text-zinc-700">
            Title
          </label>
          <Input
            id="mp-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Landscape and ecological management plan"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mp-party" className="block text-sm font-medium text-zinc-700">
            Responsible party
          </label>
          <Input
            id="mp-party"
            value={responsibleParty}
            onChange={(e) => setResponsibleParty(e.target.value)}
            placeholder="Who manages the land for 30 years"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mp-start" className="block text-sm font-medium text-zinc-700">
            Commences on
          </label>
          <Input
            id="mp-start"
            type="date"
            value={commencesOn}
            onChange={(e) => setCommencesOn(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="mp-obj" className="block text-sm font-medium text-zinc-700">
            Objectives
          </label>
          <Textarea
            id="mp-obj"
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="Target condition for each parcel."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mp-pres" className="block text-sm font-medium text-zinc-700">
            Prescriptions
          </label>
          <Textarea
            id="mp-pres"
            value={prescriptions}
            onChange={(e) => setPrescriptions(e.target.value)}
            placeholder="Cutting regime, grazing, scrub control."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="mp-rem" className="block text-sm font-medium text-zinc-700">
            Remediation strategy
          </label>
          <Textarea
            id="mp-rem"
            value={remediation}
            onChange={(e) => setRemediation(e.target.value)}
            placeholder="What happens if monitoring finds habitat off track."
            rows={2}
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        Creating the plan schedules monitoring in years 1 to 5, then 10, 15, 20, 25 and 30, running
        to the end of the obligation.
      </p>

      <Button size="sm" onClick={submit} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saving ? "Creating" : "Create plan and schedule"}
      </Button>
    </div>
  );
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
