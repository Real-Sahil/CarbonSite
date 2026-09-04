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
    return <ExistingPlan orgId={orgId} canManage={canManage} plan={plan} />;
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

function ExistingPlan({
  orgId,
  canManage,
  plan,
}: {
  orgId: string;
  canManage: boolean;
  plan: Plan;
}) {
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

      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {events.map((e) => (
            <MonitoringEventChip key={e.id} orgId={orgId} canManage={canManage} event={e} />
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

const CONDITION_OPTIONS = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "poor", label: "Poor" },
  { value: "fairly_poor", label: "Fairly poor" },
  { value: "moderate", label: "Moderate" },
  { value: "fairly_good", label: "Fairly good" },
  { value: "good", label: "Good" },
] as const;

function MonitoringEventChip({
  orgId,
  canManage,
  event,
}: {
  orgId: string;
  canManage: boolean;
  event: MonitoringEvent & { derived: string };
}) {
  const router = useRouter();
  const [recording, setRecording] = useState(false);
  const [completedOn, setCompletedOn] = useState(new Date().toISOString().slice(0, 10));
  const [surveyorName, setSurveyorName] = useState("");
  const [conditionFound, setConditionFound] = useState("");
  const [onTrack, setOnTrack] = useState(true);
  const [findings, setFindings] = useState("");
  const [remedialAction, setRemedialAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSettled = event.status === "completed" || event.status === "waived";
  const canRecord = canManage && !isSettled;

  async function submit() {
    if (!onTrack && !remedialAction.trim()) {
      setError("Habitat off track needs a remedial action.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/monitoring-events/${event.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedOn,
          onTrack,
          ...(surveyorName.trim() && { surveyorName: surveyorName.trim() }),
          ...(conditionFound && { conditionFound }),
          ...(findings.trim() && { findings: findings.trim() }),
          ...(remedialAction.trim() && { remedialAction: remedialAction.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not record the monitoring visit.");
        return;
      }
      setRecording(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const chipClass =
    event.derived === "overdue"
      ? "rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5"
      : event.status === "remediation_required"
        ? "rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
        : event.status === "completed"
          ? "rounded-md border border-green-200 bg-green-50 px-2.5 py-1.5"
          : "rounded-md border border-zinc-200 px-2.5 py-1.5";

  if (!recording) {
    return (
      <button
        type="button"
        disabled={!canRecord}
        onClick={() => canRecord && setRecording(true)}
        className={`${chipClass} text-left ${canRecord ? "cursor-pointer hover:border-zinc-400" : "cursor-default"}`}
      >
        <div className="text-xs font-medium text-zinc-700">Year {event.monitoringYear}</div>
        <div className="font-mono text-xs tabular-nums text-zinc-500">{fmtDate(event.dueOn)}</div>
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 sm:max-w-md">
      <p className="text-sm font-medium text-zinc-900">Record visit, year {event.monitoringYear}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor={`me-date-${event.id}`} className="block text-xs font-medium text-zinc-700">
            Visit date
          </label>
          <Input
            id={`me-date-${event.id}`}
            type="date"
            value={completedOn}
            onChange={(e) => setCompletedOn(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`me-surveyor-${event.id}`} className="block text-xs font-medium text-zinc-700">
            Surveyor
          </label>
          <Input
            id={`me-surveyor-${event.id}`}
            value={surveyorName}
            onChange={(e) => setSurveyorName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`me-condition-${event.id}`} className="block text-xs font-medium text-zinc-700">
            Condition found
          </label>
          <select
            id={`me-condition-${event.id}`}
            value={conditionFound}
            onChange={(e) => setConditionFound(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Not recorded</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className="block text-xs font-medium text-zinc-700">Habitat on track</span>
          <div className="flex h-9 items-center gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={onTrack} onChange={() => setOnTrack(true)} />
              Yes
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!onTrack} onChange={() => setOnTrack(false)} />
              No
            </label>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor={`me-findings-${event.id}`} className="block text-xs font-medium text-zinc-700">
          Findings
        </label>
        <Textarea
          id={`me-findings-${event.id}`}
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          rows={2}
        />
      </div>
      {!onTrack && (
        <div className="space-y-1">
          <label htmlFor={`me-remedial-${event.id}`} className="block text-xs font-medium text-zinc-700">
            Remedial action
          </label>
          <Textarea
            id={`me-remedial-${event.id}`}
            value={remedialAction}
            onChange={(e) => setRemedialAction(e.target.value)}
            rows={2}
            placeholder="What will be done to bring the habitat back on track."
          />
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save visit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRecording(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
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
