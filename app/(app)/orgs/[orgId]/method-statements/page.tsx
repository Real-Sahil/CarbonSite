"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MethodStatement {
  id: string;
  title: string;
  version: string;
  status: string;
  issuedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  project?: { name: string } | null;
  site?: { name: string } | null;
  createdBy?: { name?: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-800",
  signed_off: "bg-green-100 text-green-800",
  superseded: "bg-amber-100 text-amber-800",
};

export default function MethodStatementsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [items, setItems] = useState<MethodStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", version: "1.0", methodText: "", riskAssessmentText: "", ppeRequired: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/method-statements`);
    if (res.ok) { const j = await res.json(); setItems(j.data ?? []); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/method-statements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) { setOpen(false); setForm({ title: "", version: "1.0", methodText: "", riskAssessmentText: "", ppeRequired: "" }); await load(); }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Method Statements / RAMS</h1>
          <p className="text-sm text-muted-foreground mt-1">Risk assessments and method statements for site activities.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Statement</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No method statements yet.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Issued</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ms) => (
                <tr key={ms.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{ms.title}</td>
                  <td className="px-4 py-3 font-mono text-xs">{ms.version}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[ms.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {ms.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{ms.project?.name ?? "-"}</td>
                  <td className="px-4 py-3">{ms.issuedAt ? new Date(ms.issuedAt).toLocaleDateString("en-GB") : "-"}</td>
                  <td className="px-4 py-3">{ms.expiresAt ? new Date(ms.expiresAt).toLocaleDateString("en-GB") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Method Statement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Excavation works at Site A" />
            </div>
            <div>
              <Label>Version</Label>
              <Input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))} />
            </div>
            <div>
              <Label>Risk Assessment</Label>
              <Textarea value={form.riskAssessmentText} onChange={(e) => setForm((f) => ({ ...f, riskAssessmentText: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>Method</Label>
              <Textarea value={form.methodText} onChange={(e) => setForm((f) => ({ ...f, methodText: e.target.value }))} rows={3} />
            </div>
            <div>
              <Label>PPE Required</Label>
              <Input value={form.ppeRequired} onChange={(e) => setForm((f) => ({ ...f, ppeRequired: e.target.value }))} placeholder="Hard hat, hi-vis, steel toe-caps" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.title}>{submitting ? "Saving..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
