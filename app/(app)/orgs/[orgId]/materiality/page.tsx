"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MaterialityAssessment {
  id: string;
  name: string;
  status: string;
  reportingYear: number;
  methodology?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  _count?: { topics: number };
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-800",
  published: "bg-green-100 text-green-800",
};

export default function MaterialityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [assessments, setAssessments] = useState<MaterialityAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    reportingYear: new Date().getFullYear(),
    methodology: "",
    scope: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/materiality`);
    if (res.ok) { const j = await res.json(); setAssessments(j.data ?? []); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/materiality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          methodology: form.methodology || null,
          scope: form.scope || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", reportingYear: new Date().getFullYear(), methodology: "", scope: "" });
        await load();
      }
    } finally { setSubmitting(false); }
  };

  const publishedCount = assessments.filter((a) => a.status === "published").length;
  const draftCount = assessments.filter((a) => a.status === "draft" || a.status === "in_review").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Materiality Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">Double materiality assessments identifying financial and impact materiality topics.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Assessment</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Published</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{publishedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{draftCount}</div></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : assessments.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No materiality assessments yet.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Year</th>
                <th className="px-4 py-3 text-left font-medium">Topics</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Published</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">{a.reportingYear}</td>
                  <td className="px-4 py-3">{a._count?.topics ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {a.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("en-GB") : "-"}</td>
                  <td className="px-4 py-3">{new Date(a.createdAt).toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Materiality Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="FY2026 Double Materiality Assessment" />
            </div>
            <div>
              <Label>Reporting Year *</Label>
              <Input type="number" value={form.reportingYear} onChange={(e) => setForm((f) => ({ ...f, reportingYear: parseInt(e.target.value) || new Date().getFullYear() }))} />
            </div>
            <div>
              <Label>Methodology</Label>
              <Input value={form.methodology} onChange={(e) => setForm((f) => ({ ...f, methodology: e.target.value }))} placeholder="ESRS, GRI, CSRD..." />
            </div>
            <div>
              <Label>Scope</Label>
              <Textarea value={form.scope} onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))} rows={2} placeholder="Group-level, UK operations only, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.name}>{submitting ? "Saving..." : "Create Assessment"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
