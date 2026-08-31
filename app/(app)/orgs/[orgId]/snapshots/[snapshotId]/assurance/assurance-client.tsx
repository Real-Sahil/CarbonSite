"use client";

import { useState } from "react";
import { ShieldCheck, ShieldX, Shield, RotateCcw, CheckCircle2, XCircle, Clock, User, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SnapshotMeta {
  version: number;
  publishedAt: string;
  periodLabel: string;
  publishedBy: string;
}

interface ExistingAssurance {
  id: string;
  status: "pending" | "approved" | "rejected";
  notes: string | null;
  signedAt: string | null;
  createdAt: string;
  auditorName: string;
}

interface Props {
  orgId: string;
  snapshotId: string;
  snapshot: SnapshotMeta;
  existingAssurance: ExistingAssurance | null;
  role: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(status: "pending" | "approved" | "rejected") {
  if (status === "approved") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-transparent gap-1.5">
        <CheckCircle2 className="h-3 w-3" />
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-transparent gap-1.5">
        <XCircle className="h-3 w-3" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-transparent gap-1.5">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  );
}

export function AssuranceClient({ orgId, snapshotId, snapshot, existingAssurance, role }: Props) {
  const [assurance, setAssurance] = useState<ExistingAssurance | null>(existingAssurance);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "reject" | "retract" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = role === "auditor" || role === "admin";
  const canRetract = role === "admin";

  async function submitDecision(status: "approved" | "rejected") {
    setSubmitting(status === "approved" ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/snapshots/${snapshotId}/assurance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes: notes.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Failed to submit assurance decision");
      }
      const data = await res.json();
      setAssurance({
        id: data.assurance.id,
        status: data.assurance.status,
        notes: data.assurance.notes ?? null,
        signedAt: data.assurance.signedAt ?? null,
        createdAt: assurance?.createdAt ?? new Date().toISOString(),
        auditorName: assurance?.auditorName ?? "You",
      });
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  }

  async function retractDecision() {
    setSubmitting("retract");
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/snapshots/${snapshotId}/assurance`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? "Failed to retract assurance");
      }
      setAssurance(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#f9fafb]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[900px] mx-auto px-8 py-8">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F0F9FF] shrink-0 mt-0.5">
              <Shield className="h-4 w-4 text-[#111827]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium tracking-wide text-[#111827] uppercase">Assurance</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827]">
                Snapshot v{snapshot.version} — {snapshot.periodLabel}
              </h1>
              <p className="mt-1 text-sm text-[#9CA3AF] max-w-[65ch]">
                Auditor review and sign-off for this published snapshot. Once approved, the assurance record is appended to the audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-8 py-8 flex flex-col gap-6">
        {/* Snapshot summary */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <CardTitle className="text-sm font-semibold text-[#111827]">Snapshot details</CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-4">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetaItem label="Version" value={`v${snapshot.version}`} />
              <MetaItem label="Period" value={snapshot.periodLabel} />
              <MetaItem label="Published by" value={snapshot.publishedBy} />
              <MetaItem label="Published at" value={formatDate(snapshot.publishedAt)} />
            </dl>
          </CardContent>
        </Card>

        {/* Current assurance status */}
        <Card className="border-[#E5E7EB] shadow-none">
          <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-[#111827]">Assurance status</CardTitle>
              {assurance && statusBadge(assurance.status)}
            </div>
          </CardHeader>
          <CardContent className="px-6 py-4">
            {assurance ? (
              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <dt className="text-xs font-medium text-[#9CA3AF] mb-0.5 flex items-center gap-1">
                      <User className="h-3 w-3" /> Auditor
                    </dt>
                    <dd className="text-sm text-[#111827]">{assurance.auditorName}</dd>
                  </div>
                  {assurance.signedAt && (
                    <div>
                      <dt className="text-xs font-medium text-[#9CA3AF] mb-0.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Signed at
                      </dt>
                      <dd className="text-sm text-[#111827] tabular-nums">{formatDate(assurance.signedAt)}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs font-medium text-[#9CA3AF] mb-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Recorded at
                    </dt>
                    <dd className="text-sm text-[#111827] tabular-nums">{formatDate(assurance.createdAt)}</dd>
                  </div>
                </dl>

                {assurance.notes && (
                  <div className="rounded-md bg-[#f9fafb] border border-[#E5E7EB] px-4 py-3">
                    <p className="text-xs font-medium text-[#9CA3AF] mb-1">Auditor notes</p>
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">{assurance.notes}</p>
                  </div>
                )}

                {canRetract && (
                  <div className="pt-2 border-t border-[#f3f4f6]">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1.5"
                      onClick={retractDecision}
                      disabled={submitting !== null}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {submitting === "retract" ? "Retracting..." : "Retract assurance"}
                    </Button>
                    <p className="text-xs text-[#9CA3AF] mt-1.5">
                      Retracting removes the assurance record. This action is recorded in the audit log.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-[#9CA3AF]">
                <Clock className="h-4 w-4 shrink-0" />
                No assurance decision has been recorded for this snapshot.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Decision form — auditor/admin only */}
        {canSubmit && (
          <Card className="border-[#E5E7EB] shadow-none">
            <CardHeader className="px-6 py-4 border-b border-[#E5E7EB]">
              <CardTitle className="text-sm font-semibold text-[#111827]">
                {assurance ? "Revise decision" : "Submit assurance decision"}
              </CardTitle>
              <CardDescription className="text-xs text-[#9CA3AF] mt-0.5">
                {assurance
                  ? "You can update your previous decision. The audit log will record the change."
                  : "Review the snapshot data, then record your assurance decision."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 py-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="assurance-notes" className="text-xs font-medium text-[#374151]">
                  Notes <span className="text-[#9CA3AF] font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="assurance-notes"
                  placeholder="Describe your findings, methodology review, any caveats..."
                  className="resize-none text-sm min-h-[100px] border-[#E5E7EB] focus-visible:ring-1 focus-visible:ring-[#111827]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={submitting !== null}
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  className="gap-1.5 bg-green-700 hover:bg-green-800 text-white"
                  onClick={() => submitDecision("approved")}
                  disabled={submitting !== null}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {submitting === "approve" ? "Approving..." : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={() => submitDecision("rejected")}
                  disabled={submitting !== null}
                >
                  <ShieldX className="h-4 w-4" />
                  {submitting === "reject" ? "Rejecting..." : "Reject"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[#9CA3AF] mb-0.5">{label}</dt>
      <dd className="text-sm text-[#111827]">{value}</dd>
    </div>
  );
}
