"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormSection } from "@/components/forms/form-kit";
import { useOrgMoney } from "@/components/org/org-locale";

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
  const money = useOrgMoney();
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
      <FormSection cols={2}>
        <FormField label="Type" htmlFor="f-type" optional>
          <Select value={form.scenarioType} onValueChange={(v) => setForm((f) => ({ ...f, scenarioType: v as "physical" | "transition" }))}>
            <SelectTrigger id="f-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="physical">Physical</SelectItem>
              <SelectItem value="transition">Transition</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Time horizon" htmlFor="f-time-horizon" optional>
          <Select value={form.timeHorizon} onValueChange={(v) => setForm((f) => ({ ...f, timeHorizon: v }))}>
            <SelectTrigger id="f-time-horizon"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (0-3y)</SelectItem>
              <SelectItem value="medium">Medium (3-10y)</SelectItem>
              <SelectItem value="long">Long (10y+)</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </FormSection>
      <FormField label="Scenario name" htmlFor="f-scenario-name">
        <Input id="f-scenario-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. 2°C orderly transition" />
      </FormField>
      <FormField label="Temperature pathway" htmlFor="f-temperature-pathway" optional>
        <Input id="f-temperature-pathway" value={form.temperaturePathway} onChange={(e) => setForm((f) => ({ ...f, temperaturePathway: e.target.value }))} placeholder="e.g. 1.5°C, 2°C, 4°C" />
      </FormField>
      <FormField label="Description" htmlFor="f-description" optional>
        <Textarea id="f-description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Describe the scenario and key assumptions" />
      </FormField>
      <FormSection cols={2}>
        <FormField label={`Gross VaR low (${money.symbol})`} htmlFor="f-gross-var-low" optional>
          <Input id="f-gross-var-low" type="number" min="0" value={form.grossValueAtRiskLow} onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskLow: e.target.value }))} placeholder="0" />
        </FormField>
        <FormField label={`Gross VaR high (${money.symbol})`} htmlFor="f-gross-var-high" optional>
          <Input id="f-gross-var-high" type="number" min="0" value={form.grossValueAtRiskHigh} onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskHigh: e.target.value }))} placeholder="0" />
        </FormField>
      </FormSection>
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
