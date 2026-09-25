"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewMethodStatementButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: "", version: "1.0", methodText: "", riskAssessmentText: "", ppeRequired: "" });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/method-statements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json() as { id: string };
        setOpen(false);
        setForm({ title: "", version: "1.0", methodText: "", riskAssessmentText: "", ppeRequired: "" });
        router.push(`/orgs/${orgId}/method-statements/${data.id}`);
      }
    } catch {
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Statement</Button>
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
    </>
  );
}
