"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Download, Mail, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CompanyFinder, CompanyFlags } from "@/components/company/company-finder";
import { FormField, FormActions, FormError, FormSection } from "@/components/forms/form-kit";

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
  linkSentAt: string | null;
  openedAt: string | null;
  tokenExpiresAt: string | null;
  submittedVia: "portal_link" | "logged" | null;
  submitterName: string | null;
  submitterNote: string | null;
  hasEvidence: boolean;
}

/** Mirrors OPEN_STATUSES in lib/subcontractor/portal.ts. That module imports the database, so the client cannot import it. */
const LINK_OPEN_STATUSES: Submission["status"][] = ["requested", "overdue", "rejected"];

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
  return value != null ? `${Number(value).toFixed(2)} tCO₂e` : "-";
}

function channelLabel(via: NonNullable<Submission["submittedVia"]>) {
  return via === "portal_link" ? "Sent through the link" : "Logged by your team";
}

export function RequestSubmissionForm({ orgId, contractId }: { orgId: string; contractId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [subName, setSubName] = useState("");
  const [flags, setFlags] = useState<{ level: "red" | "amber"; text: string }[]>([]);
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
      setSubName("");
      setFlags([]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5">
      <FormSection title="Request subcontractor carbon data" cols={2}>
          <FormField label="Subcontractor" htmlFor="sub-name">
            <Input id="sub-name" name="subcontractorName" required placeholder="Subcontractor name" value={subName} onChange={(e) => setSubName(e.target.value)} />
          </FormField>
          <div className="sm:col-span-2">
            <CompanyFinder base={`/api/orgs/${orgId}/companies`} getName={() => subName} onPick={(p) => { setSubName(p.company.name); setFlags(p.flags); }} />
            {flags.length > 0 && <div className="mt-1"><CompanyFlags flags={flags} /></div>}
          </div>
          <FormField label="Contact email" htmlFor="sub-email" optional>
            <Input id="sub-email" name="contactEmail" type="email" placeholder="contact@example.com" />
          </FormField>
          <FormField label="Reporting period" htmlFor="sub-period">
            <Input id="sub-period" name="reportingPeriodLabel" required placeholder="Q3 2026" />
          </FormField>
          <FormField label="Due date" htmlFor="sub-due">
            <Input id="sub-due" name="dueDate" type="date" required />
          </FormField>
        </FormSection>
      <FormError>{error}</FormError>
      <FormActions>
        <Button type="submit" size="sm" disabled={isPending}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Requesting…" : "Request submission"}
        </Button>
      </FormActions>
    </form>
  );
}

// Each row is one request. Links are issued here and shown once (Copy link) or
// emailed to the contact. The evidence file downloads through a one-hour signed URL.
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
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSendLink = canManage && LINK_OPEN_STATUSES.includes(submission.status);
  const linkLive = submission.tokenExpiresAt !== null && new Date(submission.tokenExpiresAt).getTime() > Date.now();

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

  function issueLink(delivery: "email" | "copy") {
    setLinkError(null);
    setLinkNotice(null);
    setLinkUrl(null);
    setCopied(false);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/subcontractor-submissions/${submission.id}/link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delivery }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setLinkError(json?.message ?? "Could not create the link");
        return;
      }
      if (delivery === "copy") {
        setLinkUrl(json.url);
        setLinkExpiresAt(json.linkExpiresAt);
      } else {
        setLinkNotice(`Link emailed to ${submission.contactEmail}.`);
      }
      router.refresh();
    });
  }

  async function copyLink() {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked; the field is selectable, so the link can still be copied by hand.
      setCopied(false);
    }
  }

  function openEvidence() {
    setLinkError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/contracts/${contractId}/subcontractor-submissions/${submission.id}/evidence`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) {
        setLinkError(json?.message ?? "Could not open the evidence file");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <>
      <tr className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors align-top">
        <td className="py-3.5 pl-6 text-sm font-medium text-[#111827]">
          {submission.subcontractorName}
          {submission.contactEmail && (
            <div className="text-xs font-normal text-[#6B7280]">{submission.contactEmail}</div>
          )}
        </td>
        <td className="py-3.5 text-sm text-[#374151]">{submission.reportingPeriodLabel}</td>
        <td className="py-3.5 text-sm text-[#374151] tabular-nums">{formatDate(submission.dueDate)}</td>
        <td className="py-3.5">
          {statusBadge(submission.status)}
          {submission.submittedVia && (
            <div className="mt-1.5 text-xs text-[#6B7280]">{channelLabel(submission.submittedVia)}</div>
          )}
          {submission.linkSentAt && (
            <div className="text-xs text-[#6B7280]">Link sent {formatDate(submission.linkSentAt)}</div>
          )}
          {submission.openedAt && (
            <div className="text-xs text-[#6B7280]">Opened {formatDate(submission.openedAt)}</div>
          )}
          {canSendLink && linkLive && submission.tokenExpiresAt && (
            <div className="text-xs text-[#6B7280]">Link valid to {formatDate(submission.tokenExpiresAt)}</div>
          )}
        </td>
        <td className="py-3.5 text-sm text-[#374151] tabular-nums">
          S1 {formatTco2e(submission.scope1Tco2e)}<br />
          S2 {formatTco2e(submission.scope2Tco2e)}<br />
          S3 {formatTco2e(submission.scope3Tco2e)}
          {submission.submitterName && (
            <div className="mt-1.5 text-xs text-[#6B7280]">From {submission.submitterName}</div>
          )}
          {submission.submitterNote && (
            <div className="max-w-[28ch] text-xs text-[#6B7280]">{submission.submitterNote}</div>
          )}
        </td>
        <td className="py-3.5 pr-6">
          <div className="flex flex-col items-start gap-2">
            {canSendLink && submission.contactEmail && (
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => issueLink("email")}
                title={submission.linkSentAt ? "Replaces the link sent earlier" : undefined}
              >
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                {submission.linkSentAt ? "Resend link" : "Send link"}
              </Button>
            )}
            {canSendLink && (
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => issueLink("copy")}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy link
              </Button>
            )}
            {submission.hasEvidence && (
              <Button size="sm" variant="ghost" disabled={isPending} onClick={openEvidence}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Evidence
              </Button>
            )}
            {linkNotice && <p className="text-xs text-[#374151]">{linkNotice}</p>}
            {linkError && <p className="max-w-[20ch] text-xs text-red-600">{linkError}</p>}
          </div>
          <div className="mt-2">
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
              <p className="mt-2 text-xs text-red-600 max-w-[20ch]">{submission.rejectionReason}</p>
            )}
          </div>
        </td>
      </tr>
      {linkUrl && (
        <tr className="border-b border-[#F3F4F6] bg-[#F9FAFB]">
          <td colSpan={6} className="px-6 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                readOnly
                value={linkUrl}
                aria-label={`Link for ${submission.subcontractorName}`}
                className="h-8 text-xs"
                onFocus={(e) => e.currentTarget.select()}
              />
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" aria-label="Hide link" onClick={() => setLinkUrl(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              Shown once{linkExpiresAt ? `, expires ${formatDate(linkExpiresAt)}` : ""}. Issuing a new link replaces this one.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}
