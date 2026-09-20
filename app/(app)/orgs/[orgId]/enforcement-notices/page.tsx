"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EnforcementNotice {
  id: string;
  reference: string;
  issuingBody: string;
  noticeType: string;
  status: string;
  issuedAt: string;
  complianceDeadline?: string | null;
  compliedAt?: string | null;
  subject: string;
}

const NOTICE_TYPES = [
  { value: "improvement_notice", label: "Improvement Notice" },
  { value: "prohibition_notice", label: "Prohibition Notice" },
  { value: "enforcement_notice", label: "Enforcement Notice" },
  { value: "stop_notice", label: "Stop Notice" },
  { value: "remediation_notice", label: "Remediation Notice" },
  { value: "warning_letter", label: "Warning Letter" },
  { value: "statutory_notice", label: "Statutory Notice" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-800",
  appealed: "bg-yellow-100 text-yellow-800",
  complied: "bg-green-100 text-green-800",
  extended: "bg-orange-100 text-orange-800",
  withdrawn: "bg-gray-100 text-gray-700",
  overdue: "bg-red-200 text-red-900",
};

export default function EnforcementNoticesPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [notices, setNotices] = useState<EnforcementNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reference: "", issuingBody: "", noticeType: "improvement_notice",
    issuedAt: new Date().toISOString().slice(0, 10),
    complianceDeadline: "", subject: "", requirements: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/orgs/${orgId}/enforcement-notices`);
    if (res.ok) { const j = await res.json(); setNotices(j.data ?? []); }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/enforcement-notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          complianceDeadline: form.complianceDeadline || null,
          requirements: form.requirements || null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        setForm({ reference: "", issuingBody: "", noticeType: "improvement_notice", issuedAt: new Date().toISOString().slice(0, 10), complianceDeadline: "", subject: "", requirements: "" });
        await load();
      }
    } finally { setSubmitting(false); }
  };

  const openCount = notices.filter((n) => n.status === "open" || n.status === "overdue").length;
  const overdueCount = notices.filter((n) => n.status === "overdue" || (n.complianceDeadline && !n.compliedAt && new Date(n.complianceDeadline) < new Date())).length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enforcement Notices</h1>
          <p className="text-sm text-muted-foreground mt-1">Track regulatory enforcement notices, compliance deadlines, and appeals.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record Notice</Button>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertOctagon className="h-4 w-4 flex-shrink-0" />
          <span>{overdueCount} notice{overdueCount !== 1 ? "s" : ""} with overdue compliance deadlines.</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
      ) : notices.length === 0 ? (
        <div className="text-sm text-muted-foreground py-16 text-center">No enforcement notices recorded.</div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Issuing Body</th>
                <th className="px-4 py-3 text-left font-medium">Issued</th>
                <th className="px-4 py-3 text-left font-medium">Deadline</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">{n.reference}</td>
                  <td className="px-4 py-3 capitalize">{n.noticeType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{n.issuingBody}</td>
                  <td className="px-4 py-3">{new Date(n.issuedAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    {n.complianceDeadline ? (
                      <span className={!n.compliedAt && new Date(n.complianceDeadline) < new Date() ? "text-red-600 font-medium" : ""}>
                        {new Date(n.complianceDeadline).toLocaleDateString("en-GB")}
                      </span>
                    ) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[n.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Enforcement Notice</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Reference *</Label>
                <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="EN-2026-001" />
              </div>
              <div className="flex-1">
                <Label>Issuing Body *</Label>
                <Input value={form.issuingBody} onChange={(e) => setForm((f) => ({ ...f, issuingBody: e.target.value }))} placeholder="Environment Agency" />
              </div>
            </div>
            <div>
              <Label>Notice Type *</Label>
              <Select value={form.noticeType} onValueChange={(v) => setForm((f) => ({ ...f, noticeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{NOTICE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label>Issued Date *</Label>
                <Input type="date" value={form.issuedAt} onChange={(e) => setForm((f) => ({ ...f, issuedAt: e.target.value }))} />
              </div>
              <div className="flex-1">
                <Label>Compliance Deadline</Label>
                <Input type="date" value={form.complianceDeadline} onChange={(e) => setForm((f) => ({ ...f, complianceDeadline: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Requirements</Label>
              <Textarea value={form.requirements} onChange={(e) => setForm((f) => ({ ...f, requirements: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !form.reference || !form.issuingBody || !form.subject}>{submitting ? "Saving..." : "Record Notice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
