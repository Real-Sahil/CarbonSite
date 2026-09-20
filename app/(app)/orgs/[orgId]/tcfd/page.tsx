"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, ChevronRight, CloudSun, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface TcfdScenario {
  id: string;
  scenarioType: "physical" | "transition";
  name: string;
  temperaturePathway?: string;
  timeHorizon: "short" | "medium" | "long";
  description?: string;
  grossValueAtRiskLow?: number;
  grossValueAtRiskHigh?: number;
  createdAt: string;
  riskAssessments: { id: string; riskCategory: string; likelihood: number; impact: number }[];
}

const TIME_HORIZON_LABEL: Record<string, string> = {
  short: "Short (0-3y)",
  medium: "Medium (3-10y)",
  long: "Long (10y+)",
};

function riskScore(likelihood: number, impact: number) {
  return likelihood * impact;
}

function riskBadge(score: number) {
  if (score >= 20) return <Badge variant="destructive">Critical</Badge>;
  if (score >= 12) return <Badge className="bg-orange-500 text-white">High</Badge>;
  if (score >= 6) return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}

function ScenarioForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<TcfdScenario>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
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
          <Label htmlFor="scenarioType">Type</Label>
          <Select
            value={form.scenarioType}
            onValueChange={(v) => setForm((f) => ({ ...f, scenarioType: v as "physical" | "transition" }))}
          >
            <SelectTrigger id="scenarioType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="physical">Physical</SelectItem>
              <SelectItem value="transition">Transition</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="timeHorizon">Time horizon</Label>
          <Select
            value={form.timeHorizon}
            onValueChange={(v) => setForm((f) => ({ ...f, timeHorizon: v as "short" | "medium" | "long" }))}
          >
            <SelectTrigger id="timeHorizon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short (0-3y)</SelectItem>
              <SelectItem value="medium">Medium (3-10y)</SelectItem>
              <SelectItem value="long">Long (10y+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Scenario name</Label>
        <Input
          id="name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          placeholder="e.g. 2°C orderly transition"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="temperaturePathway">Temperature pathway</Label>
        <Input
          id="temperaturePathway"
          value={form.temperaturePathway}
          onChange={(e) => setForm((f) => ({ ...f, temperaturePathway: e.target.value }))}
          placeholder="e.g. 1.5°C, 2°C, 4°C"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          rows={3}
          placeholder="Describe the scenario and key assumptions"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="varLow">Gross VaR low (£)</Label>
          <Input
            id="varLow"
            type="number"
            min="0"
            value={form.grossValueAtRiskLow}
            onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskLow: e.target.value }))}
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="varHigh">Gross VaR high (£)</Label>
          <Input
            id="varHigh"
            type="number"
            min="0"
            value={form.grossValueAtRiskHigh}
            onChange={(e) => setForm((f) => ({ ...f, grossValueAtRiskHigh: e.target.value }))}
            placeholder="0"
          />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save scenario"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function TcfdPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const router = useRouter();
  const [scenarios, setScenarios] = useState<TcfdScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TcfdScenario | null>(null);
  const [activeTab, setActiveTab] = useState<"physical" | "transition">("physical");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [orgId]);

  async function handleCreate(data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setCreating(false);
      await load();
    }
  }

  async function handleUpdate(scenarioId: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setEditing(null);
      await load();
    }
  }

  async function handleDelete(scenario: TcfdScenario) {
    if (!confirm(`Delete scenario "${scenario.name}"? This will also delete all associated risks.`)) return;
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenario.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  const filtered = scenarios.filter((s) => s.scenarioType === activeTab);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">TCFD Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Model physical and transition climate risks under the TCFD framework.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New scenario
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "physical" | "transition")}>
        <TabsList>
          <TabsTrigger value="physical" className="gap-2">
            <CloudSun className="w-4 h-4" />
            Physical
          </TabsTrigger>
          <TabsTrigger value="transition" className="gap-2">
            <Zap className="w-4 h-4" />
            Transition
          </TabsTrigger>
        </TabsList>

        {(["physical", "transition"] as const).map((tab) => (
          <TabsContent key={tab} value={tab}>
            {loading ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No {tab} scenarios yet</p>
                <p className="text-sm mt-1">
                  Add a scenario to start mapping climate risks.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 mt-3">
                {filtered.map((scenario) => {
                  const maxScore = scenario.riskAssessments.reduce(
                    (m, r) => Math.max(m, riskScore(r.likelihood, r.impact)),
                    0,
                  );
                  return (
                    <Card key={scenario.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base">{scenario.name}</CardTitle>
                            <CardDescription className="mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>{TIME_HORIZON_LABEL[scenario.timeHorizon]}</span>
                              {scenario.temperaturePathway && (
                                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {scenario.temperaturePathway}
                                </span>
                              )}
                              {maxScore > 0 && riskBadge(maxScore)}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditing(scenario)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDelete(scenario)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => router.push(`/orgs/${orgId}/tcfd/${scenario.id}`)}
                            >
                              Risks
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {(scenario.description || scenario.riskAssessments.length > 0) && (
                        <CardContent className="pt-0">
                          {scenario.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {scenario.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{scenario.riskAssessments.length} risk{scenario.riskAssessments.length !== 1 ? "s" : ""} assessed</span>
                            {scenario.grossValueAtRiskLow != null && (
                              <span>
                                VaR: £{scenario.grossValueAtRiskLow.toLocaleString()}
                                {scenario.grossValueAtRiskHigh != null &&
                                  ` – £${scenario.grossValueAtRiskHigh.toLocaleString()}`}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New TCFD scenario</DialogTitle>
          </DialogHeader>
          <ScenarioForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit scenario</DialogTitle>
          </DialogHeader>
          {editing && (
            <ScenarioForm
              initial={editing}
              onSubmit={(data) => handleUpdate(editing.id, data)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
