"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TnfdScenario {
  id: string;
  name: string;
  riskRating?: string | null;
  gbfTarget?: string | null;
  timeHorizon?: string | null;
  sectorScope?: string | null;
  financialImpactLow?: number | null;
  financialImpactHigh?: number | null;
  createdAt: string;
  createdBy?: { name?: string } | null;
}

const RISK_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const TIME_HORIZONS = [
  { value: "short_term", label: "Short Term (0-3 years)" },
  { value: "medium_term", label: "Medium Term (3-10 years)" },
  { value: "long_term", label: "Long Term (10+ years)" },
];

export default function TnfdPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [scenarios, setScenarios] = useState<TnfdScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    gbfTarget: "",
    timeHorizon: "medium_term",
    sectorScope: "",
    riskRating: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/tnfd`);
    if (res.ok) { const j = await res.json(); setScenarios(j.data ?? []); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tnfd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description || null,
          gbfTarget: form.gbfTarget || null,
          sectorScope: form.sectorScope || null,
          riskRating: form.riskRating || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", description: "", gbfTarget: "", timeHorizon: "medium_term", sectorScope: "", riskRating: "" });
        await load();
      }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TNFD Scenarios</h1>
          <p className="text-sm text-muted-foreground mt-1">Nature-related financial disclosure scenarios using the LEAP framework.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Scenario</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : scenarios.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Leaf className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No TNFD scenarios yet. Use the LEAP framework to assess nature-related risks and opportunities.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Scenario</th>
                <th className="px-4 py-3 text-left font-medium">GBF Target</th>
                <th className="px-4 py-3 text-left font-medium">Sector Scope</th>
                <th className="px-4 py-3 text-left font-medium">Time Horizon</th>
                <th className="px-4 py-3 text-left font-medium">Risk Rating</th>
                <th className="px-4 py-3 text-left font-medium">Financial Impact</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.gbfTarget ?? "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.sectorScope ?? "-"}</td>
                  <td className="px-4 py-3 capitalize">{s.timeHorizon?.replaceAll("_", " ") ?? "-"}</td>
                  <td className="px-4 py-3">
                    {s.riskRating ? (
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${RISK_COLORS[s.riskRating] ?? "bg-gray-100 text-gray-700"}`}>
                        {s.riskRating}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {s.financialImpactLow != null || s.financialImpactHigh != null ? (
                      <span className="font-variant-numeric tabular-nums">
                        {s.financialImpactLow != null ? `£${Number(s.financialImpactLow).toLocaleString()}` : ""}
                        {s.financialImpactLow != null && s.financialImpactHigh != null ? " - " : ""}
                        {s.financialImpactHigh != null ? `£${Number(s.financialImpactHigh).toLocaleString()}` : ""}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New TNFD Scenario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Scenario Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Biodiversity loss in supply chain" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>GBF Target</Label>
                <Input value={form.gbfTarget} onChange={(e) => setForm((f) => ({ ...f, gbfTarget: e.target.value }))} placeholder="Target 3, Target 15..." />
              </div>
              <div className="flex-1">
                <Label>Time Horizon</Label>
                <Select value={form.timeHorizon} onValueChange={(v) => setForm((f) => ({ ...f, timeHorizon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_HORIZONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Sector Scope</Label>
                <Input value={form.sectorScope} onChange={(e) => setForm((f) => ({ ...f, sectorScope: e.target.value }))} placeholder="Construction, Agriculture..." />
              </div>
              <div className="flex-1">
                <Label>Risk Rating</Label>
                <Select value={form.riskRating} onValueChange={(v) => setForm((f) => ({ ...f, riskRating: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name}>{submitting ? "Saving..." : "Create Scenario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
