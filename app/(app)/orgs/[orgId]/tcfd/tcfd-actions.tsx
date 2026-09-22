"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TcfdScenario {
  id: string;
  scenarioType: "physical" | "transition";
  name: string;
  temperaturePathway?: string | null;
  timeHorizon: string;
  description?: string | null;
  grossValueAtRiskLow?: number | null;
  grossValueAtRiskHigh?: number | null;
}

interface ScenarioFormProps {
  initial?: Partial<TcfdScenario>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

function ScenarioForm({ initial, onSubmit, onCancel }: ScenarioFormProps) {
  const [form, setForm] = useState({
    scenarioType: initial?.scenarioType ?? "physical",
    name: initial?.name ?? "",
    temperaturePathway: initial?.temperaturePathway ?? "",
    timeHorizon: initial?.timeHorizon ?? "medium",
    description: initial?.description ?? "",
    grossValueAtRiskLow: initial?.grossValueAtRiskLow?.toString() ?? "",
    grossValueAtRiskHigh: initial?.grossValueAtRiskHigh?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        temperaturePathway: form.temperaturePathway || undefined,
        description: form.description || undefined,
        grossValueAtRiskLow: form.grossValueAtRiskLow ? Number(form.grossValueAtRiskLow) : undefined,
        grossValueAtRiskHigh: form.grossValueAtRiskHigh ? Number(form.grossValueAtRiskHigh) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={form.scenarioType} onValueChange={(v) => setForm((f) => ({ ...f, scenarioType: v as "physical" | "transition" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="physical">Physical</SelectItem>
              <SelectItem value="transition">Transition</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Time horizon</Label>
          <Select value={form.timeHorizon} onValueChange={(v) => setForm((f) => ({ ...f, timeHorizon: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (0-3y)</SelectItem>
              <SelectItem value="medium">Medium (3-10y)</SelectItem>
              <SelectItem value="long">Long (10y+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label>Scenario name *</Label>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. 2°C orderly transition" />
      </div>
      <div className="space-y-1">
        <Label>Temperature pathway</Label>
        <Input value={form.temperaturePathway} onChange={(e) => setForm((f) => ({ ...f, temperaturePathway: e.target.value }))} placeholder="e.g. 1.5°C, 2°C, 4°C" />
      </div>
      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the scenario and key assumptions" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Gross VaR low (£)</Label>
          <Input type="number" min="0" value={form.grossValueAtRiskLow} onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskLow: e.target.value }))} placeholder="0" />
        </div>
        <div className="space-y-1">
          <Label>Gross VaR high (£)</Label>
          <Input type="number" min="0" value={form.grossValueAtRiskHigh} onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskHigh: e.target.value }))} placeholder="0" />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save scenario"}</Button>
      </DialogFooter>
    </form>
  );
}

export function NewScenarioButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleCreate(data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-2" /> New scenario
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New TCFD scenario</DialogTitle></DialogHeader>
          <ScenarioForm onSubmit={handleCreate} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditScenarioButton({ orgId, scenario }: { orgId: string; scenario: TcfdScenario }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleUpdate(data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit scenario</DialogTitle></DialogHeader>
          <ScenarioForm initial={scenario} onSubmit={handleUpdate} onCancel={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteScenarioButton({ orgId, scenario }: { orgId: string; scenario: TcfdScenario }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete scenario "${scenario.name}"? This will also delete all associated risks.`)) return;
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenario.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={handleDelete}>
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
  );
}
