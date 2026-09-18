"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface DatapointNarrativeEditorProps {
  orgId: string;
  datapointId: string;
  datapointTitle: string;
  framework: string;
  code: string;
  initialNarrative: string | null;
}

export function DatapointNarrativeEditor({
  orgId,
  datapointId,
  datapointTitle,
  framework,
  code,
  initialNarrative,
}: DatapointNarrativeEditorProps) {
  const [narrative, setNarrative] = useState(initialNarrative ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(
        `/api/orgs/${orgId}/compliance/datapoints/${datapointId}/narrative`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicNarrative: narrative || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Failed to save narrative.");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  const isChanged = narrative !== (initialNarrative ?? "");

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white">
      <div>
        <h3 className="font-semibold text-gray-900">
          {framework} {code} — Public Disclosure
        </h3>
        <p className="text-sm text-gray-600 mt-1">{datapointTitle}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="narrative" className="text-sm font-medium text-gray-700">
          Narrative (ESRS disclosure text)
        </label>
        <Textarea
          id="narrative"
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          disabled={saving}
          placeholder="Enter disclosure narrative for this ESRS datapoint. Markdown formatting is supported."
          rows={8}
          className="min-h-[200px]"
        />
        <p className="text-xs text-gray-500">
          Max 50,000 characters. This will be published in assurance reports.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">Narrative saved successfully.</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setNarrative(initialNarrative ?? "")}
          disabled={!isChanged || saving}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isChanged || saving}
        >
          {saving ? "Saving…" : "Save Narrative"}
        </Button>
      </div>
    </div>
  );
}
