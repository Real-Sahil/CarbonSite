"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, AlertTriangle, Clock, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface HsIncident {
  id: string;
  reference: string;
  incidentType: string;
  status: string;
  occurredAt: string;
  description: string;
  lostTimeDays: number;
  riddorReportable: boolean;
  reportedBy?: { name?: string } | null;
}

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

const STATUS_COLORS: Record<string, string> = {
  reported: "bg-yellow-100 text-yellow-800",
  investigating: "bg-blue-100 text-blue-800",
  action_required: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800",
};

function statusBadge(status: string) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function HsIncidentsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [incidents, setIncidents] = useState<HsIncident[]>([]);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/hs-incidents`);
    if (res.ok) {
      const json = await res.json();
      setIncidents(json.data ?? []);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

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
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const ltiCount = incidents.filter((i) => i.incidentType === "lost_time_injury" || i.status !== "closed").length;
  const riddorCount = incidents.filter((i) => i.riddorReportable).length;
  const closedCount = incidents.filter((i) => i.status === "closed").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">H&S Incident Register</h1>
          <p className="text-sm text-muted-foreground mt-1">Track, investigate, and close health and safety incidents.</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Report Incident
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open / Investigating</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{ltiCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">RIDDOR Reportable</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{riddorCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Closed</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{closedCount}</div></CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No incidents recorded. Use the button above to report one.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Occurred</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">LTI Days</th>
                <th className="px-4 py-3 text-left font-medium">RIDDOR</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{inc.reference}</td>
                  <td className="px-4 py-3 capitalize">{inc.incidentType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{new Date(inc.occurredAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">{statusBadge(inc.status)}</td>
                  <td className="px-4 py-3">{inc.lostTimeDays}</td>
                  <td className="px-4 py-3">{inc.riddorReportable ? <Badge variant="destructive">Yes</Badge> : <span className="text-muted-foreground">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
  );
}
