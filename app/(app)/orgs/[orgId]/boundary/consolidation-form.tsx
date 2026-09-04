"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Loader2 } from "lucide-react";

const APPROACHES = [
  { value: "operational_control", label: "Operational control" },
  { value: "financial_control", label: "Financial control" },
  { value: "equity_share", label: "Equity share" },
] as const;

export function ConsolidationApproachForm({
  orgId,
  current,
}: {
  orgId: string;
  current: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [approach, setApproach] = useState(current);
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function submit() {
    if (rationale.trim().length < 10) {
      setError("Give a rationale of at least 10 characters. It is recorded against the change.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/boundary`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consolidationApproach: approach, rationale }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "Could not change the consolidation approach.");
        return;
      }
      const body = (await res.json()) as {
        recalculation: { isSignificant: boolean; deltaPercent: number | null } | null;
      };
      setResult(
        body.recalculation
          ? body.recalculation.isSignificant
            ? `Approach changed. The base year moved by ${body.recalculation.deltaPercent?.toFixed(2)}%, which is significant, so a restatement is awaiting approval.`
            : "Approach changed. The base year was reassessed and the change fell below the significance threshold, so no restatement is needed."
          : "Approach changed and logged as a structural change. No active base year to reassess.",
      );
      setOpen(false);
      setRationale("");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (result && !open) {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
        {result}{" "}
        <button
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
          className="font-medium underline underline-offset-2"
        >
          Change again
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change approach
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="space-y-1.5">
        <label htmlFor="approach" className="text-sm font-medium text-zinc-700">
          Consolidation approach
        </label>
        <select
          id="approach"
          value={approach}
          onChange={(e) => setApproach(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-400"
        >
          {APPROACHES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rationale" className="text-sm font-medium text-zinc-700">
          Rationale
        </label>
        <Textarea
          id="rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why the approach is changing. Recorded against the structural change and visible to assurance."
          rows={3}
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs leading-relaxed text-zinc-500">
        This is a boundary change. It will be logged as a structural change and assessed against
        the active base year straight away.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving || approach === current}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Saving" : "Save approach"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setError(null);
            setApproach(current);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
