"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus, Siren } from "lucide-react";

const TYPES = [
  { value: "spill", label: "Spill" },
  { value: "exceedance", label: "Exceedance of a permit limit" },
  { value: "unauthorised_release", label: "Unauthorised release" },
  { value: "complaint", label: "Complaint" },
  { value: "near_miss", label: "Near miss" },
  { value: "waste_misrouting", label: "Waste misrouting" },
  { value: "equipment_failure", label: "Equipment failure" },
  { value: "ecological_damage", label: "Ecological damage" },
  { value: "other", label: "Other" },
] as const;

const SEVERITIES = [
  { value: "negligible", label: "Negligible", hint: "No environmental harm" },
  { value: "minor", label: "Minor", hint: "Contained, no lasting effect" },
  { value: "moderate", label: "Moderate", hint: "Localised harm or a limit exceeded" },
  { value: "major", label: "Major", hint: "Significant harm, notify within 72 hours" },
  { value: "severe", label: "Severe", hint: "Serious harm, notify within 24 hours" },
] as const;

/** Mirrors defaultRegulatorNotifiable so the form can warn before submitting. */
function willBeNotifiable(type: string, severity: string): boolean {
  if (severity === "major" || severity === "severe") return true;
  return (
    severity === "moderate" &&
    ["unauthorised_release", "exceedance", "ecological_damage"].includes(type)
  );
}

export function ReportIncidentForm({
  orgId,
  facilities,
  permits,
}: {
  orgId: string;
  facilities: Array<{ id: string; name: string }>;
  permits: Array<{ id: string; reference: string; title: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("spill");
  const [severity, setSeverity] = useState<string>("minor");
  const [occurredAt, setOccurredAt] = useState(toLocalInput(new Date()));
  const [discoveredAt, setDiscoveredAt] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [permitId, setPermitId] = useState("");
  const [description, setDescription] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [affectedMedium, setAffectedMedium] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notifiable = willBeNotifiable(type, severity);

  async function submit() {
    if (description.trim().length < 10) {
      setError("Describe what happened in at least a sentence.");
      return;
    }
    const occurred = new Date(occurredAt);
    if (Number.isNaN(occurred.getTime())) {
      setError("Give a valid date and time for when the incident occurred.");
      return;
    }
    if (occurred.getTime() > Date.now() + 60_000) {
      setError("An incident cannot be recorded as occurring in the future.");
      return;
    }
    if (discoveredAt) {
      const discovered = new Date(discoveredAt);
      if (discovered.getTime() < occurred.getTime()) {
        setError("An incident cannot be discovered before it occurred.");
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          severity,
          occurredAt: occurred.toISOString(),
          ...(discoveredAt && { discoveredAt: new Date(discoveredAt).toISOString() }),
          ...(facilityId && { facilityId }),
          ...(permitId && { permitId }),
          description: description.trim(),
          ...(immediateAction.trim() && { immediateAction: immediateAction.trim() }),
          ...(affectedMedium.trim() && { affectedMedium: affectedMedium.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not record the incident.");
        return;
      }
      setOpen(false);
      setDescription("");
      setImmediateAction("");
      setAffectedMedium("");
      setDiscoveredAt("");
      setFacilityId("");
      setPermitId("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Report incident
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Type" htmlFor="i-type">
          <select
            id="i-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Severity"
          htmlFor="i-sev"
          hint={SEVERITIES.find((s) => s.value === severity)?.hint}
        >
          <select
            id="i-sev"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Facility" htmlFor="i-fac">
          <select
            id="i-fac"
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">Organisation wide</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Occurred at" htmlFor="i-occ">
          <Input
            id="i-occ"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </Field>

        <Field
          label="Discovered at"
          htmlFor="i-disc"
          hint="The notification clock runs from here"
        >
          <Input
            id="i-disc"
            type="datetime-local"
            value={discoveredAt}
            onChange={(e) => setDiscoveredAt(e.target.value)}
          />
        </Field>

        <Field label="Permit affected" htmlFor="i-permit">
          <select
            id="i-permit"
            value={permitId}
            onChange={(e) => setPermitId(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="">None</option>
            {permits.map((p) => (
              <option key={p.id} value={p.id}>
                {p.reference} · {p.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="What happened" htmlFor="i-desc">
        <Textarea
          id="i-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What was released or breached, where, how much, and how it was noticed."
          rows={3}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Immediate action taken" htmlFor="i-action">
          <Textarea
            id="i-action"
            value={immediateAction}
            onChange={(e) => setImmediateAction(e.target.value)}
            placeholder="Containment or making safe."
            rows={2}
          />
        </Field>
        <Field label="Medium affected" htmlFor="i-medium" hint="Air, water, land, or several">
          <Input
            id="i-medium"
            value={affectedMedium}
            onChange={(e) => setAffectedMedium(e.target.value)}
            placeholder="Surface water"
          />
        </Field>
      </div>

      {notifiable && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <Siren className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm leading-relaxed text-amber-900">
            At this type and severity the incident will be flagged as notifiable to the regulator,
            with a target of {severity === "severe" ? "24" : "72"} hours from discovery. The
            register will show it as overdue until a notification date is recorded.
          </p>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Recording" : "Record incident"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
