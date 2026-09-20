"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Risk {
  id: string;
  riskCategory: string;
  description: string;
  likelihood: number;
  impact: number;
  financialImpactLow?: number;
  financialImpactHigh?: number;
  adaptationActions?: string;
  residualLikelihood?: number;
  residualImpact?: number;
  reviewDate?: string;
  owner?: { name?: string; email: string };
}

interface Scenario {
  id: string;
  name: string;
  scenarioType: string;
  timeHorizon: string;
  temperaturePathway?: string;
  description?: string;
  riskAssessments: Risk[];
}

function riskScore(l: number, i: number) { return l * i; }

function riskBadge(score: number) {
  if (score >= 20) return <Badge variant="destructive">Critical</Badge>;
  if (score >= 12) return <Badge className="bg-orange-500 text-white">High</Badge>;
  if (score >= 6) return <Badge className="bg-yellow-500 text-black">Medium</Badge>;
  return <Badge variant="secondary">Low</Badge>;
}

function ScoreCell({ label, value, max = 5 }: { label: string; value?: number; max?: number }) {
  if (!value) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <div className="text-center">
      <div className="font-semibold tabular-nums">{value}/{max}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function RiskForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Risk>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    riskCategory: initial?.riskCategory ?? "",
    description: initial?.description ?? "",
    likelihood: initial?.likelihood?.toString() ?? "3",
    impact: initial?.impact?.toString() ?? "3",
    financialImpactLow: initial?.financialImpactLow?.toString() ?? "",
    financialImpactHigh: initial?.financialImpactHigh?.toString() ?? "",
    adaptationActions: initial?.adaptationActions ?? "",
    residualLikelihood: initial?.residualLikelihood?.toString() ?? "",
    residualImpact: initial?.residualImpact?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        financialImpactLow: form.financialImpactLow ? Number(form.financialImpactLow) : undefined,
        financialImpactHigh: form.financialImpactHigh ? Number(form.financialImpactHigh) : undefined,
        residualLikelihood: form.residualLikelihood ? Number(form.residualLikelihood) : undefined,
        residualImpact: form.residualImpact ? Number(form.residualImpact) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  function scaleInput(id: string, label: string, key: keyof typeof form, required = false) {
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{label} {required && "(1-5)"}</Label>
        <Input
          id={id}
          type="number"
          min="1"
          max="5"
          required={required}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="riskCategory">Risk category</Label>
        <Input
          id="riskCategory"
          value={form.riskCategory}
          onChange={(e) => setForm((f) => ({ ...f, riskCategory: e.target.value }))}
          required
          placeholder="e.g. Policy and legal, Market, Technology"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          required
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {scaleInput("likelihood", "Likelihood", "likelihood", true)}
        {scaleInput("impact", "Impact", "impact", true)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="fimpLow">Financial impact low (£)</Label>
          <Input
            id="fimpLow"
            type="number"
            min="0"
            value={form.financialImpactLow}
            onChange={(e) => setForm((f) => ({ ...f, financialImpactLow: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fimpHigh">Financial impact high (£)</Label>
          <Input
            id="fimpHigh"
            type="number"
            min="0"
            value={form.financialImpactHigh}
            onChange={(e) => setForm((f) => ({ ...f, financialImpactHigh: e.target.value }))}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="adaptationActions">Adaptation actions</Label>
        <Textarea
          id="adaptationActions"
          value={form.adaptationActions}
          onChange={(e) => setForm((f) => ({ ...f, adaptationActions: e.target.value }))}
          rows={2}
          placeholder="What actions reduce this risk?"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {scaleInput("residualLikelihood", "Residual likelihood", "residualLikelihood")}
        {scaleInput("residualImpact", "Residual impact", "residualImpact")}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save risk"}</Button>
      </DialogFooter>
    </form>
  );
}

export default function TcfdScenarioPage() {
  const { orgId, scenarioId } = useParams<{ orgId: string; scenarioId: string }>();
  const router = useRouter();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenarioId}`);
      if (res.ok) {
        const data = await res.json();
        setScenario(data.scenario);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [orgId, scenarioId]);

  async function handleAddRisk(data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/scenarios/${scenarioId}/risks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setAdding(false); await load(); }
  }

  async function handleUpdateRisk(riskId: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/orgs/${orgId}/tcfd/risks/${riskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setEditing(null); await load(); }
  }

  async function handleDeleteRisk(risk: Risk) {
    if (!confirm(`Delete risk "${risk.riskCategory}"?`)) return;
    const res = await fetch(`/api/orgs/${orgId}/tcfd/risks/${risk.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!scenario) return <div className="p-6 text-muted-foreground">Scenario not found.</div>;

  const risks = scenario.riskAssessments ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/orgs/${orgId}/tcfd`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{scenario.name}</h1>
          <p className="text-sm text-muted-foreground">
            {scenario.scenarioType === "physical" ? "Physical" : "Transition"} scenario
            {scenario.temperaturePathway && ` — ${scenario.temperaturePathway}`}
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add risk
        </Button>
      </div>

      {scenario.description && (
        <p className="text-sm text-muted-foreground max-w-2xl">{scenario.description}</p>
      )}

      {risks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No risks assessed yet</p>
          <p className="text-sm mt-1">Add risks to map the impact of this scenario.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {risks
            .sort((a, b) => riskScore(b.likelihood, b.impact) - riskScore(a.likelihood, a.impact))
            .map((risk) => {
              const gross = riskScore(risk.likelihood, risk.impact);
              const residual = risk.residualLikelihood && risk.residualImpact
                ? riskScore(risk.residualLikelihood, risk.residualImpact)
                : null;
              return (
                <Card key={risk.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-medium">{risk.riskCategory}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {risk.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {riskBadge(gross)}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => setEditing(risk)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteRisk(risk)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-6 text-xs">
                      <ScoreCell label="Likelihood" value={risk.likelihood} />
                      <ScoreCell label="Impact" value={risk.impact} />
                      <div className="text-center">
                        <div className="font-semibold tabular-nums">{gross}</div>
                        <div className="text-muted-foreground">Score</div>
                      </div>
                      {residual != null && (
                        <>
                          <div className="text-muted-foreground">→</div>
                          <ScoreCell label="Res. L" value={risk.residualLikelihood} />
                          <ScoreCell label="Res. I" value={risk.residualImpact} />
                          <div className="text-center">
                            <div className="font-semibold tabular-nums text-green-600">{residual}</div>
                            <div className="text-muted-foreground">Residual</div>
                          </div>
                        </>
                      )}
                      {risk.financialImpactLow != null && (
                        <div className="ml-auto text-muted-foreground">
                          £{risk.financialImpactLow.toLocaleString()}
                          {risk.financialImpactHigh != null && ` – £${risk.financialImpactHigh.toLocaleString()}`}
                        </div>
                      )}
                    </div>
                    {risk.adaptationActions && (
                      <p className="mt-2 text-xs text-muted-foreground border-t pt-2">
                        <span className="font-medium">Actions: </span>
                        {risk.adaptationActions}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
        </div>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add risk assessment</DialogTitle>
          </DialogHeader>
          <RiskForm onSubmit={handleAddRisk} onCancel={() => setAdding(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit risk</DialogTitle>
          </DialogHeader>
          {editing && (
            <RiskForm
              initial={editing}
              onSubmit={(data) => handleUpdateRisk(editing.id, data)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
