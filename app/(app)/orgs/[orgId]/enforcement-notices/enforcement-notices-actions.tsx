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

const NOTICE_TYPES = [
  { value: "improvement_notice", label: "Improvement Notice" },
  { value: "prohibition_notice", label: "Prohibition Notice" },
  { value: "enforcement_notice", label: "Enforcement Notice" },
  { value: "stop_notice", label: "Stop Notice" },
  { value: "remediation_notice", label: "Remediation Notice" },
  { value: "warning_letter", label: "Warning Letter" },
  { value: "statutory_notice", label: "Statutory Notice" },
];

export function RecordNoticeButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    reference: "", issuingBody: "", noticeType: "improvement_notice",
    issuedAt: new Date().toISOString().slice(0, 10),
    complianceDeadline: "", subject: "", requirements: "",
  });

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
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Record Notice</Button>
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
    </>
  );
}
