"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NewAssessmentButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    esrsScope: "",
    methodologyNotes: "",
    stakeholderInput: "",
  });

  async function handleSubmit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/materiality`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          esrsScope: form.esrsScope || null,
          methodologyNotes: form.methodologyNotes || null,
          stakeholderInput: form.stakeholderInput || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", esrsScope: "", methodologyNotes: "", stakeholderInput: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Assessment
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Materiality Assessment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="FY2026 Double Materiality Assessment"
              />
            </div>
            <div>
              <Label>ESRS Scope</Label>
              <Input
                value={form.esrsScope}
                onChange={(e) => setForm((f) => ({ ...f, esrsScope: e.target.value }))}
                placeholder="ESRS, CSRD, GRI..."
              />
            </div>
            <div>
              <Label>Methodology Notes</Label>
              <Textarea
                value={form.methodologyNotes}
                onChange={(e) => setForm((f) => ({ ...f, methodologyNotes: e.target.value }))}
                rows={2}
                placeholder="Double materiality methodology description..."
              />
            </div>
            <div>
              <Label>Stakeholder Input</Label>
              <Textarea
                value={form.stakeholderInput}
                onChange={(e) => setForm((f) => ({ ...f, stakeholderInput: e.target.value }))}
                rows={2}
                placeholder="Group-level, UK operations only, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.name}>
              {saving ? "Saving..." : "Create Assessment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
