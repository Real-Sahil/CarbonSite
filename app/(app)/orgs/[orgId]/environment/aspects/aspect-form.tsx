"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

/**
 * Mirrors rateSignificance so the form can show the rating as the user moves
 * the sliders. The server recomputes it on save, so this is a preview rather
 * than the source of truth.
 */
function previewSignificance(severity: number, likelihood: number, legal: number): string {
  if (legal === 5) return "significant";
  const score = severity * likelihood * legal;
  if (score >= 60) return "significant";
  if (score >= 30) return "high";
  if (score >= 12) return "medium";
  return "low";
}

const SCORE_HINTS: Record<string, string[]> = {
  severity: [
    "Negligible effect",
    "Minor, quickly reversible",
    "Localised, reversible over months",
    "Widespread or slow to reverse",
    "Severe or irreversible harm",
  ],
  likelihood: [
    "Almost never",
    "Rare",
    "Occasional",
    "Frequent",
    "Continuous or near certain",
  ],
  legal: [
    "No specific requirement",
    "Good practice guidance",
    "General duty applies",
    "Specific regulatory requirement",
    "Permit limit or statutory offence",
  ],
};

export function CreateAspectForm({
  orgId,
  facilities,
}: {
  orgId: string;
  facilities: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState("");
  const [aspect, setAspect] = useState("");
  const [impact, setImpact] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [operatingCondition, setOperatingCondition] = useState("normal");
  const [severityScore, setSeverityScore] = useState(3);
  const [likelihoodScore, setLikelihoodScore] = useState(3);
  const [legalScore, setLegalScore] = useState(3);
  const [existingControls, setExistingControls] = useState("");
  const [furtherAction, setFurtherAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rating = previewSignificance(severityScore, likelihoodScore, legalScore);
  const score = severityScore * likelihoodScore * legalScore;
  const needsControl = rating === "significant" || rating === "high";

  async function submit() {
    if (!activity.trim() || !aspect.trim() || !impact.trim()) {
      setError("Activity, aspect and impact are all required.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/aspects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activity: activity.trim(),
          aspect: aspect.trim(),
          impact: impact.trim(),
          ...(facilityId && { facilityId }),
          operatingCondition,
          severityScore,
          likelihoodScore,
          legalScore,
          ...(existingControls.trim() && { existingControls: existingControls.trim() }),
          ...(furtherAction.trim() && { furtherAction: furtherAction.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not add the aspect.");
        return;
      }
      setOpen(false);
      setActivity("");
      setAspect("");
      setImpact("");
      setExistingControls("");
      setFurtherAction("");
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
        Add aspect
      </Button>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="a-activity" className="block text-sm font-medium text-zinc-700">
            Activity
          </label>
          <Input
            id="a-activity"
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            placeholder="Bulk diesel storage"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-aspect" className="block text-sm font-medium text-zinc-700">
            Aspect
          </label>
          <Input
            id="a-aspect"
            value={aspect}
            onChange={(e) => setAspect(e.target.value)}
            placeholder="Potential release of fuel"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-impact" className="block text-sm font-medium text-zinc-700">
            Impact
          </label>
          <Input
            id="a-impact"
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="Contamination of groundwater"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="a-facility" className="block text-sm font-medium text-zinc-700">
            Facility
          </label>
          <select
            id="a-facility"
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
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-cond" className="block text-sm font-medium text-zinc-700">
            Operating condition
          </label>
          <select
            id="a-cond"
            value={operatingCondition}
            onChange={(e) => setOperatingCondition(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            <option value="normal">Normal</option>
            <option value="abnormal">Abnormal</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>

      <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
        <ScoreSlider
          id="a-sev"
          label="Severity"
          value={severityScore}
          onChange={setSeverityScore}
          hints={SCORE_HINTS.severity}
        />
        <ScoreSlider
          id="a-like"
          label="Likelihood"
          value={likelihoodScore}
          onChange={setLikelihoodScore}
          hints={SCORE_HINTS.likelihood}
        />
        <ScoreSlider
          id="a-legal"
          label="Legal exposure"
          value={legalScore}
          onChange={setLegalScore}
          hints={SCORE_HINTS.legal}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3">
          <span className="text-sm text-zinc-500">
            Score <span className="font-mono font-semibold text-zinc-900">{score}</span> of 125
          </span>
          <span
            className={
              needsControl
                ? "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold capitalize text-amber-900"
                : "rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold capitalize text-zinc-700"
            }
          >
            {rating}
          </span>
        </div>

        {legalScore === 5 && (
          <p className="text-xs leading-relaxed text-zinc-500">
            Maximum legal exposure rates the aspect significant regardless of likelihood, because
            a breach of a statutory limit is significant even when it is rare.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="a-controls" className="block text-sm font-medium text-zinc-700">
            Existing controls
          </label>
          <Textarea
            id="a-controls"
            value={existingControls}
            onChange={(e) => setExistingControls(e.target.value)}
            placeholder="Bunded tank, weekly visual inspection, spill kit on site."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="a-action" className="block text-sm font-medium text-zinc-700">
            Further action
          </label>
          <Textarea
            id="a-action"
            value={furtherAction}
            onChange={(e) => setFurtherAction(e.target.value)}
            placeholder="What still needs doing, and by when."
            rows={2}
          />
        </div>
      </div>

      {needsControl && !existingControls.trim() && !furtherAction.trim() && (
        <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          A {rating} aspect needs either a control or a planned action recorded against it. You can
          save without one, but it will show on the register as missing.
        </p>
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
          {saving ? "Saving" : "Add aspect"}
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

function ScoreSlider({
  id,
  label,
  value,
  onChange,
  hints,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (n: number) => void;
  hints: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-zinc-700">
          {label}
        </label>
        <span className="text-xs text-zinc-500">{hints[value - 1]}</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-zinc-900"
        />
        <span className="w-4 shrink-0 text-right font-mono text-sm font-semibold tabular-nums text-zinc-900">
          {value}
        </span>
      </div>
    </div>
  );
}
