"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Programme {
  id: string;
  name: string;
  status: string;
  clientName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budgetTco2e?: number | null;
  createdAt: string;
  programmeManager?: { name?: string } | null;
  _count?: { projects: number };
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-700",
};

export default function ProgrammesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", clientName: "", startDate: "", endDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/programmes`);
    if (res.ok) { const j = await res.json(); setProgrammes(j.data ?? []); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/programmes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          description: form.description || null,
          clientName: form.clientName || null,
        }),
      });
      if (res.ok) { setOpen(false); setForm({ name: "", description: "", clientName: "", startDate: "", endDate: "" }); await load(); }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programmes</h1>
          <p className="text-sm text-muted-foreground mt-1">Group projects under programmes for portfolio-level carbon tracking.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Programme</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : programmes.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No programmes yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                    {p.status.replaceAll("_", " ")}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                {p.clientName && <div>Client: {p.clientName}</div>}
                {p.programmeManager?.name && <div>Manager: {p.programmeManager.name}</div>}
                <div>Projects: {p._count?.projects ?? 0}</div>
                {p.startDate && <div>Start: {new Date(p.startDate).toLocaleDateString("en-GB")}</div>}
                {p.endDate && <div>End: {new Date(p.endDate).toLocaleDateString("en-GB")}</div>}
                {p.budgetTco2e && <div>Budget: {Number(p.budgetTco2e).toLocaleString()} tCO2e</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Programme</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="HS2 Phase 2 Package A" />
            </div>
            <div>
              <Label>Client</Label>
              <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="flex-1">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name}>{submitting ? "Saving..." : "Create Programme"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
