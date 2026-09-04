"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface Submission {
  id: string;
  subcontractorName: string;
  contactEmail: string | null;
  reportingPeriodLabel: string;
  dueDate: string;
  status: "requested" | "submitted" | "verified" | "rejected" | "overdue";
  scope1Tco2e: string | null;
  scope2Tco2e: string | null;
  scope3Tco2e: string | null;
  notes: string | null;
  rejectionReason: string | null;
}

function statusBadge(status: Submission["status"]) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Verified</Badge>;
    case "submitted":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">Submitted</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Rejected</Badge>;
    default:
      return <Badge variant="outline">Requested</Badge>;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTco2e(value: string | null) {
  return value != null ? `${Number(value).toFixed(2)} tCO2e` : "-";
}

export function RequestSubmissionForm({ orgId, contractId }: { orgId: string; contractId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    const body = {
      subcontractorName: data.get("subcontractorName") as string,
      contactEmail: (data.get("contactEmail") as string) || undefined,
      reportingPeriodLabel: data.get("reportingPeriodLabel") as string,
      dueDate: data.get("dueDate") as string,
      notes: (data.get("notes") as string) || undefined,
    };
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/contracts/${contractId}/subcontractor-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not request submission");
        return;
      }
      form.reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[14px] border border-[#E5E7EB] p-[21px] flex flex-col gap-4">
      <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">Request subcontractor carbon data</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sub-name" className="text-xs text-[#374151] tracking-[-0.36px]">
            Subcontractor <span aria-hidden="true" className="text-red-500">*</span>
          </Label>
          <Input id="sub-name" name="subcontractorName" required placeholder="Subcontractor name" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sub-email" className="text-xs text-[#374151] tracking-[-0.36px]">Contact email</Label>
          <Input id="sub-email" name="contactEmail" type="email" placeholder="contact@example.com" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sub-period" className="text-xs text-[#374151] tracking-[-0.36px]">
            Reporting period <span aria-hidden="true" className="text-red-500">*</span>
          </Label>
          <Input id="sub-period" name="reportingPeriodLabel" required placeholder="Q3 2026" className="h-9 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sub-due" className="text-xs text-[#374151] tracking-[-0.36px]">
            Due date <span aria-hidden="true" className="text-red-500">*</span>
          </Label>
          <Input id="sub-due" name="dueDate" type="date" required className="h-9 text-sm" />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <Button type="submit" size="sm" disabled={isPending}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Requesting…" : "Request submission"}
        </Button>
      </div>
    </form>
  );
}

export function SubmissionRow({
  orgId,
  contractId,
  submission,
  canManage,
}: {
  orgId: string;
  contractId: string;
  submission: Submission;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [scope1, setScope1] = useState("");
  const [scope2, setScope2] = useState("");
  const [scope3, setScope3] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function callAction(body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/subcontractor-submissions/${submission.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.message ?? "Could not update submission");
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors align-top">
      <td className="py-3.5 pl-6 text-sm font-medium text-[#111827]">
        {submission.subcontractorName}
        {submission.contactEmail && (
          <div className="text-xs font-normal text-[#9CA3AF]">{submission.contactEmail}</div>
        )}
      </td>
      <td className="py-3.5 text-sm text-[#374151]">{submission.reportingPeriodLabel}</td>
      <td className="py-3.5 text-sm text-[#374151] tabular-nums">{formatDate(submission.dueDate)}</td>
      <td className="py-3.5">{statusBadge(submission.status)}</td>
      <td className="py-3.5 text-sm text-[#374151] tabular-nums">
        S1 {formatTco2e(submission.scope1Tco2e)}<br />
        S2 {formatTco2e(submission.scope2Tco2e)}<br />
        S3 {formatTco2e(submission.scope3Tco2e)}
      </td>
      <td className="py-3.5 pr-6">
        {canManage && (submission.status === "requested" || submission.status === "overdue") && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Log submission</Button>
        )}
        {canManage && submission.status === "submitted" && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => callAction({ action: "verify" })} disabled={isPending}>Verify</Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const reason = window.prompt("Reason for rejecting this submission?");
                if (reason) callAction({ action: "reject", rejectionReason: reason });
              }}
              disabled={isPending}
            >
              Reject
            </Button>
          </div>
        )}
        {editing && (
          <div className="flex flex-col gap-2 rounded-md border border-[#E5E7EB] bg-white p-3">
            <div className="flex gap-2">
              <Input placeholder="Scope 1" value={scope1} onChange={(e) => setScope1(e.target.value)} className="h-8 w-20 text-xs" type="number" min="0" step="0.01" />
              <Input placeholder="Scope 2" value={scope2} onChange={(e) => setScope2(e.target.value)} className="h-8 w-20 text-xs" type="number" min="0" step="0.01" />
              <Input placeholder="Scope 3" value={scope3} onChange={(e) => setScope3(e.target.value)} className="h-8 w-20 text-xs" type="number" min="0" step="0.01" />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  callAction({
                    action: "submit",
                    scope1Tco2e: scope1 ? Number(scope1) : undefined,
                    scope2Tco2e: scope2 ? Number(scope2) : undefined,
                    scope3Tco2e: scope3 ? Number(scope3) : undefined,
                  })
                }
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}
        {submission.status === "rejected" && submission.rejectionReason && (
          <p className="text-xs text-red-600 max-w-[20ch]">{submission.rejectionReason}</p>
        )}
      </td>
    </tr>
  );
}
