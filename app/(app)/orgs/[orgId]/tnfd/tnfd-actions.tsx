"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIME_HORIZONS = [
  { value: "short_term", label: "Short Term (0-3 years)" },
  { value: "medium_term", label: "Medium Term (3-10 years)" },
  { value: "long_term", label: "Long Term (10+ years)" },
];

export function NewTnfdScenarioButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    gbfTarget: "",
    timeHorizon: "medium_term",
    sectorScope: "",
    riskRating: "",
  });

  async function handleSubmit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/tnfd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || null,
          gbfTarget: form.gbfTarget || null,
          timeHorizon: form.timeHorizon,
          sectorScope: form.sectorScope || null,
          riskRating: form.riskRating || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ name: "", description: "", gbfTarget: "", timeHorizon: "medium_term", sectorScope: "", riskRating: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> New Scenario
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New TNFD Scenario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Scenario Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Biodiversity loss in supply chain"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>GBF Target</Label>
                <Input
                  value={form.gbfTarget}
                  onChange={(e) => setForm((f) => ({ ...f, gbfTarget: e.target.value }))}
                  placeholder="Target 3, Target 15..."
                />
              </div>
              <div className="flex-1">
                <Label>Time Horizon</Label>
                <Select value={form.timeHorizon} onValueChange={(v) => setForm((f) => ({ ...f, timeHorizon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_HORIZONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Sector Scope</Label>
                <Input
                  value={form.sectorScope}
                  onChange={(e) => setForm((f) => ({ ...f, sectorScope: e.target.value }))}
                  placeholder="Construction, Agriculture..."
                />
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
            <Button onClick={handleSubmit} disabled={saving || !form.name}>
              {saving ? "Saving..." : "Create Scenario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
