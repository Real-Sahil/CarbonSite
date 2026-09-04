"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2, Plus } from "lucide-react";

const STATUSES = [
  { value: "not_assessed", label: "Not assessed" },
  { value: "compliant", label: "Compliant" },
  { value: "at_risk", label: "At risk" },
  { value: "breach", label: "In breach" },
] as const;

export function CreateLegalEntryForm({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [citation, setCitation] = useState("");
  const [jurisdiction, setJurisdiction] = useState("England and Wales");
  const [applicability, setApplicability] = useState("");
  const [obligation, setObligation] = useState("");
  const [complianceStatus, setComplianceStatus] = useState<string>("not_assessed");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [nextReviewOn, setNextReviewOn] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !applicability.trim() || !obligation.trim()) {
      setError("Title, applicability and obligation are all required.");
      return;
    }
    if (referenceUrl.trim()) {
      try {
        new URL(referenceUrl.trim());
      } catch {
        setError("The reference link must be a full URL, including https://.");
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/legal-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ...(citation.trim() && { citation: citation.trim() }),
          ...(jurisdiction.trim() && { jurisdiction: jurisdiction.trim() }),
          applicability: applicability.trim(),
          obligation: obligation.trim(),
          complianceStatus,
          ...(evidenceSummary.trim() && { evidenceSummary: evidenceSummary.trim() }),
          ...(nextReviewOn && { nextReviewOn }),
          ...(referenceUrl.trim() && { referenceUrl: referenceUrl.trim() }),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not add the register entry.");
        return;
      }
      setOpen(false);
      setTitle("");
      setCitation("");
      setApplicability("");
      setObligation("");
      setEvidenceSummary("");
      setNextReviewOn("");
      setReferenceUrl("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add entry
      </Button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5 lg:col-span-2">
          <label htmlFor="l-title" className="block text-sm font-medium text-zinc-700">
            Instrument
          </label>
          <Input
            id="l-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Environmental Permitting (England and Wales) Regulations 2016"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-cite" className="block text-sm font-medium text-zinc-700">
            Citation
          </label>
          <Input
            id="l-cite"
            value={citation}
            onChange={(e) => setCitation(e.target.value)}
            placeholder="SI 2016/1154"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-juris" className="block text-sm font-medium text-zinc-700">
            Jurisdiction
          </label>
          <Input
            id="l-juris"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-status" className="block text-sm font-medium text-zinc-700">
            Compliance position
          </label>
          <select
            id="l-status"
            value={complianceStatus}
            onChange={(e) => setComplianceStatus(e.target.value)}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-review" className="block text-sm font-medium text-zinc-700">
            Next review
          </label>
          <Input
            id="l-review"
            type="date"
            value={nextReviewOn}
            onChange={(e) => setNextReviewOn(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="l-applic" className="block text-sm font-medium text-zinc-700">
            How it applies here
          </label>
          <Textarea
            id="l-applic"
            value={applicability}
            onChange={(e) => setApplicability(e.target.value)}
            placeholder="Which sites, activities or waste streams it bites on."
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-oblig" className="block text-sm font-medium text-zinc-700">
            What we must do
          </label>
          <Textarea
            id="l-oblig"
            value={obligation}
            onChange={(e) => setObligation(e.target.value)}
            placeholder="The practical requirement, not a restatement of the section."
            rows={2}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="l-evid" className="block text-sm font-medium text-zinc-700">
            Evidence of compliance
          </label>
          <Textarea
            id="l-evid"
            value={evidenceSummary}
            onChange={(e) => setEvidenceSummary(e.target.value)}
            placeholder="What an auditor would be shown."
            rows={2}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="l-url" className="block text-sm font-medium text-zinc-700">
            Reference link
          </label>
          <Input
            id="l-url"
            type="url"
            value={referenceUrl}
            onChange={(e) => setReferenceUrl(e.target.value)}
            placeholder="https://www.legislation.gov.uk/..."
          />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving" : "Add entry"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
