"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Material */}
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Material</Label>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select from ICE library..." />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {Array.from(new Set(materials.map((m) => m.category))).sort().map((cat) => (
                <div key={cat}>
                  <div className="px-2 py-1 text-xs font-semibold text-zinc-400 uppercase tracking-wide sticky top-0 bg-white">{cat}</div>
                  {materials.filter((m) => m.category === cat).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span>{m.name}</span>
                      <span className="ml-1.5 text-zinc-400 text-xs">({m.gwpA1A3} kgCO2e/{m.declaredUnit})</span>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          {selectedMaterial && (
            <p className="text-xs text-zinc-500 mt-1">
              A1-A3 factor: <span className="font-medium">{selectedMaterial.gwpA1A3} kgCO2e/{selectedMaterial.declaredUnit}</span>
            </p>
          )}
        </div>

        {/* Quantity + unit */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Quantity</Label>
          <Input
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 5000"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-700">Unit</Label>
          <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="tonne">tonne</SelectItem>
              <SelectItem value="m3">m3</SelectItem>
              <SelectItem value="m2">m2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Project */}
        {projects.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Project (optional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="No project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Period */}
        {reportingPeriods.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-zinc-700">Reporting period (optional)</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="No period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No period</SelectItem>
                {reportingPeriods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Lifecycle stages */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">Lifecycle stages (BS EN 15978)</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map((stage) => {
            const active = stages.includes(stage);
            return (
              <button
                key={stage}
                type="button"
                onClick={() => toggleStage(stage)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                    : "bg-white text-zinc-600 border-[#E2E8F0] hover:border-[#4F46E5]"
                }`}
              >
                {stage}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-zinc-400">A1-A3 is always available. A4/A5 require transport data in the ICE entry.</p>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-700">Notes (optional)</Label>
        <Input
          placeholder="Delivery note reference, supplier, etc."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 text-sm"
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="bg-[#228B22] hover:bg-[#1a6b1a] text-white h-9 px-4 text-sm"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {isPending ? "Saving..." : "Add record"}
      </Button>
    </form>
  );
}
