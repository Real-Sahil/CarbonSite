"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Plus } from "lucide-react";

const STAGES = [
  { value: "baseline", label: "Baseline (as surveyed today)" },
  { value: "retained", label: "Retained through the scheme" },
  { value: "enhanced", label: "Enhanced to a better condition" },
  { value: "created", label: "Created where there was none" },
] as const;

const MODULES = [
  { value: "area", label: "Area habitat", unit: "ha" },
  { value: "hedgerow", label: "Hedgerow", unit: "km" },
  { value: "watercourse", label: "Watercourse", unit: "km" },
] as const;

const DISTINCTIVENESS = [
  { value: "very_low", label: "Very low", score: 0 },
  { value: "low", label: "Low", score: 2 },
  { value: "medium", label: "Medium", score: 4 },
  { value: "high", label: "High", score: 6 },
  { value: "very_high", label: "Very high", score: 8 },
] as const;

const CONDITIONS = [
  { value: "not_assessed", label: "Not assessed", score: 1 },
  { value: "poor", label: "Poor", score: 1 },
  { value: "fairly_poor", label: "Fairly poor", score: 1.5 },
  { value: "moderate", label: "Moderate", score: 2 },
  { value: "fairly_good", label: "Fairly good", score: 2.5 },
  { value: "good", label: "Good", score: 3 },
] as const;

const SIGNIFICANCE = [
  { value: "low", label: "Not in the local strategy", multiplier: 1.0 },
  { value: "medium", label: "Ecologically desirable", multiplier: 1.1 },
  { value: "high", label: "In the local nature recovery strategy", multiplier: 1.15 },
] as const;

const DIFFICULTIES = [
  { value: "low", label: "Low", multiplier: 1.0 },
  { value: "medium", label: "Medium", multiplier: 0.67 },
  { value: "high", label: "High", multiplier: 0.33 },
  { value: "very_high", label: "Very high", multiplier: 0.1 },
] as const;

const SPATIAL_RISKS = [
  { value: "on_site", label: "On site or same authority", multiplier: 1.0 },
  { value: "outside_neighbouring", label: "Neighbouring authority", multiplier: 0.75 },
  { value: "outside_distant", label: "Further afield", multiplier: 0.5 },
] as const;

/** Mirrors the server calculation so the form previews units live. */
function previewUnits(params: {
  stage: string;
  size: number;
  distinctiveness: number;
  condition: number;
  significance: number;
  difficulty: number;
  years: number;
  spatial: number;
}): number {
  const base =
    Math.max(0, params.size) * params.distinctiveness * params.condition * params.significance;
  if (params.stage !== "created" && params.stage !== "enhanced") return base;
  const time = params.years > 0 ? 1 / Math.pow(1.035, Math.min(params.years, 30)) : 1;
  return base * params.difficulty * time * params.spatial;
}

export function AddParcelForm({
  orgId,
  assessmentId,
}: {
  orgId: string;
  assessmentId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>("baseline");
  const [moduleValue, setModuleValue] = useState<string>("area");
  const [broadHabitat, setBroadHabitat] = useState("");
  const [habitatType, setHabitatType] = useState("");
  const [size, setSize] = useState("1");
  const [distinctiveness, setDistinctiveness] = useState<string>("medium");
  const [condition, setCondition] = useState<string>("moderate");
  const [significance, setSignificance] = useState<string>("low");
  const [difficulty, setDifficulty] = useState<string>("low");
  const [years, setYears] = useState("0");
  const [spatialRisk, setSpatialRisk] = useState<string>("on_site");
  const [parcelReference, setParcelReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFuture = stage === "created" || stage === "enhanced";
  const unit = MODULES.find((m) => m.value === moduleValue)?.unit ?? "ha";

  const units = previewUnits({
    stage,
    size: Number(size) || 0,
    distinctiveness: DISTINCTIVENESS.find((d) => d.value === distinctiveness)?.score ?? 0,
    condition: CONDITIONS.find((c) => c.value === condition)?.score ?? 1,
    significance: SIGNIFICANCE.find((s) => s.value === significance)?.multiplier ?? 1,
    difficulty: DIFFICULTIES.find((d) => d.value === difficulty)?.multiplier ?? 1,
    years: Number(years) || 0,
    spatial: SPATIAL_RISKS.find((s) => s.value === spatialRisk)?.multiplier ?? 1,
  });

  async function submit() {
    if (!broadHabitat.trim() || !habitatType.trim()) {
      setError("Both the broad habitat and the specific habitat type are needed.");
      return;
    }
    const sizeNum = Number(size);
    if (!Number.isFinite(sizeNum) || sizeNum < 0) {
      setError("Size must be a positive number.");
      return;
    }
    const yearsNum = Number(years);
    if (isFuture && distinctiveness !== "very_low" && (!Number.isFinite(yearsNum) || yearsNum < 1)) {
      setError(
        "Habitat being created or enhanced needs a realistic number of years to reach its target condition.",
      );
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/biodiversity/${assessmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          module: moduleValue,
          broadHabitat: broadHabitat.trim(),
          habitatType: habitatType.trim(),
          size: sizeNum,
          distinctiveness,
          condition,
          strategicSignificance: significance,
          difficulty,
          yearsToTargetCondition: isFuture ? yearsNum : 0,
          spatialRisk,
          ...(parcelReference.trim() && { parcelReference: parcelReference.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not add the parcel.");
        return;
      }
      setBroadHabitat("");
      setHabitatType("");
      setParcelReference("");
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
        Add parcel
      </Button>
    );
  }

  return (
    <div className="w-full space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Stage" htmlFor="p-stage">
          <Select id="p-stage" value={stage} onChange={setStage}>
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Module" htmlFor="p-module">
          <Select id="p-module" value={moduleValue} onChange={setModuleValue}>
            {MODULES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Broad habitat" htmlFor="p-broad" hint="UK Habitat Classification">
          <Input
            id="p-broad"
            value={broadHabitat}
            onChange={(e) => setBroadHabitat(e.target.value)}
            placeholder="Grassland"
          />
        </Field>

        <Field label="Habitat type" htmlFor="p-type">
          <Input
            id="p-type"
            value={habitatType}
            onChange={(e) => setHabitatType(e.target.value)}
            placeholder="Other neutral grassland"
          />
        </Field>

        <Field label={`Size (${unit})`} htmlFor="p-size">
          <Input
            id="p-size"
            type="number"
            min={0}
            step={0.001}
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </Field>

        <Field label="Distinctiveness" htmlFor="p-dist">
          <Select id="p-dist" value={distinctiveness} onChange={setDistinctiveness}>
            {DISTINCTIVENESS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label} ({d.score})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Condition" htmlFor="p-cond">
          <Select id="p-cond" value={condition} onChange={setCondition}>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label} ({c.score})
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Strategic significance" htmlFor="p-sig">
          <Select id="p-sig" value={significance} onChange={setSignificance}>
            {SIGNIFICANCE.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {isFuture && (
        <div className="space-y-3 rounded-md border border-zinc-200 bg-white p-3">
          <p className="text-sm font-medium text-zinc-700">Delivery risk</p>
          <p className="text-xs leading-relaxed text-zinc-500">
            Habitat that does not exist yet is discounted for how hard it is to create, how long it
            takes to reach target condition, and how far from the site it sits.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Difficulty" htmlFor="p-diff">
              <Select id="p-diff" value={difficulty} onChange={setDifficulty}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label} (x{d.multiplier})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Years to target condition" htmlFor="p-years">
              <Input
                id="p-years"
                type="number"
                min={0}
                max={30}
                value={years}
                onChange={(e) => setYears(e.target.value)}
              />
            </Field>

            <Field label="Location" htmlFor="p-spatial">
              <Select id="p-spatial" value={spatialRisk} onChange={setSpatialRisk}>
                {SPATIAL_RISKS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} (x{s.multiplier})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
        <span className="text-sm text-zinc-500">Biodiversity units</span>
        <span className="font-mono text-lg font-semibold tabular-nums text-zinc-900">
          {units.toFixed(3)}
        </span>
      </div>

      {distinctiveness === "very_low" && (
        <p className="text-xs leading-relaxed text-zinc-500">
          Very low distinctiveness habitat scores zero units. Record it anyway: the baseline needs
          to account for the whole site, including hardstanding and buildings.
        </p>
      )}

      <Field label="Parcel reference" htmlFor="p-ref" hint="Optional, matches your survey plan">
        <Input
          id="p-ref"
          value={parcelReference}
          onChange={(e) => setParcelReference(e.target.value)}
          placeholder="P-14"
        />
      </Field>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Adding" : "Add parcel"}
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
          Done
        </Button>
      </div>
    </div>
  );
}

function Select({
  id,
  value,
  onChange,
  children,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
    >
      {children}
    </select>
  );
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
