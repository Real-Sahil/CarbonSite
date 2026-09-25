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

const INCIDENT_TYPES = [
  { value: "near_miss", label: "Near Miss" },
  { value: "first_aid", label: "First Aid" },
  { value: "medical_treatment", label: "Medical Treatment" },
  { value: "lost_time_injury", label: "Lost Time Injury" },
  { value: "riddor_reportable", label: "RIDDOR Reportable" },
  { value: "dangerous_occurrence", label: "Dangerous Occurrence" },
  { value: "occupational_disease", label: "Occupational Disease" },
  { value: "fatality", label: "Fatality" },
];

export function ReportIncidentButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reference: "",
    incidentType: "near_miss",
    occurredAt: new Date().toISOString().slice(0, 16),
    description: "",
    lostTimeDays: 0,
    riddorReportable: false,
    ppeWorn: true,
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/hs-incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, occurredAt: new Date(form.occurredAt).toISOString() }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ reference: "", incidentType: "near_miss", occurredAt: new Date().toISOString().slice(0, 16), description: "", lostTimeDays: 0, riddorReportable: false, ppeWorn: true });
        router.refresh();
      }
    } catch {
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Report Incident
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Incident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reference *</Label>
              <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="INC-2026-001" />
            </div>
            <div>
              <Label>Incident Type *</Label>
              <Select value={form.incidentType} onValueChange={(v) => setForm((f) => ({ ...f, incidentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date and Time *</Label>
              <Input type="datetime-local" value={form.occurredAt} onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))} />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Lost Time Days</Label>
                <Input type="number" min={0} value={form.lostTimeDays} onChange={(e) => setForm((f) => ({ ...f, lostTimeDays: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="flex items-end gap-2">
                <input type="checkbox" id="riddor" checked={form.riddorReportable} onChange={(e) => setForm((f) => ({ ...f, riddorReportable: e.target.checked }))} className="h-4 w-4 rounded border" />
                <Label htmlFor="riddor">RIDDOR Reportable</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.reference || !form.description}>
              {submitting ? "Saving..." : "Report Incident"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
