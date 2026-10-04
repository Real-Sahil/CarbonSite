"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";

type Material = {
  id: string;
  name: string;
  category: string;
  gwpA1A3: number;
  declaredUnit: string;
};

type Project = { id: string; name: string };
type Period = { id: string; label: string };

type Stage = "A1-A3" | "A4" | "A5" | "C1-C4" | "D";
const ALL_STAGES: Stage[] = ["A1-A3", "A4", "A5", "C1-C4", "D"];

interface Props {
  orgId: string;
  materials: Material[];
  projects: Project[];
  reportingPeriods: Period[];
}

export function EmbodiedCarbonForm({ orgId, materials, projects, reportingPeriods }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [materialId, setMaterialId] = useState("");
  const [projectId, setProjectId] = useState("none");
  const [periodId, setPeriodId] = useState("none");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<"kg" | "tonne" | "m3" | "m2">("kg");
  const [stages, setStages] = useState<Stage[]>(["A1-A3"]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedMaterial = materials.find((m) => m.id === materialId);

  function toggleStage(stage: Stage) {
    setStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!materialId) { setError("Please select a material."); return; }
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      setError("Enter a valid positive quantity."); return;
    }
    if (stages.length === 0) { setError("Select at least one lifecycle stage."); return; }

    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/embodied-carbon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId,
          projectId: projectId === "none" ? undefined : projectId,
          reportingPeriodId: periodId === "none" ? undefined : periodId,
          quantity: Number(quantity),
          unit,
          stages,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? "Failed to save record.");
        return;
      }

      setMaterialId("");
      setQuantity("");
      setNotes("");
      setStages(["A1-A3"]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormError>{error}</FormError>

      <FormSection title="Material and quantity" cols={3}>
        <FormField label="Material" htmlFor="f-material" span={3}>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger id="f-material" className="w-full">
              <SelectValue placeholder="Select from ICE library..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from(new Set(materials.map((m) => m.category))).sort().map((cat) => (
                <div key={cat}>
                  <div className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase tracking-wide sticky top-0 bg-white">{cat}</div>
                  {materials.filter((m) => m.category === cat).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.name}</span>
                      <span className="ml-1.5 text-zinc-500 text-xs">({m.gwpA1A3} kgCO2e/{m.declaredUnit})</span>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          {selectedMaterial && (
            <p className="text-xs text-zinc-500">
              A1-A3 factor: <span className="font-medium">{selectedMaterial.gwpA1A3} kgCO2e/{selectedMaterial.declaredUnit}</span>
            </p>
          )}
        </FormField>
        <FormField label="Quantity" htmlFor="f-quantity" span={2}>
          <Input id="f-quantity" type="number" min="0" step="any" placeholder="e.g. 5000" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </FormField>
        <FormField label="Unit" htmlFor="f-unit">
          <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
            <SelectTrigger id="f-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="tonne">tonne</SelectItem>
              <SelectItem value="m3">m3</SelectItem>
              <SelectItem value="m2">m2</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>

      {(projects.length > 0 || reportingPeriods.length > 0) && (
        <FormSection title="Linked to" description="Link the record to a project and a reporting period so it appears in their totals." cols={2}>
          {projects.length > 0 && (
            <FormField label="Project" htmlFor="f-project" optional>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="f-project" className="w-full">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
          {reportingPeriods.length > 0 && (
            <FormField label="Reporting period" htmlFor="f-reporting-period" optional>
              <Select value={periodId} onValueChange={setPeriodId}>
                <SelectTrigger id="f-reporting-period" className="w-full">
                  <SelectValue placeholder="No period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No period</SelectItem>
                  {reportingPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        </FormSection>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-zinc-900">Lifecycle stages (BS EN 15978)</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map((stage) => {
            const active = stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                aria-pressed={active}
                onClick={() => toggleStage(stage)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[#c2410c] text-white border-[#f97316]"
                    : "bg-white text-zinc-600 border-[#E5E7EB] hover:border-[#f97316]"
                }`}
              >
                {stage}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-500">A1-A3 is always available. A4/A5 require transport data in the ICE entry.</p>
      </fieldset>

      <FormSection title="Reference" cols={2}>
        <FormField label="Notes" htmlFor="f-notes" span={4} optional>
          <Input id="f-notes" placeholder="Delivery note reference, supplier, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </FormSection>

      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isPending ? "Saving..." : "Add record"}
        </Button>
      </FormActions>
    </form>
  );
}
