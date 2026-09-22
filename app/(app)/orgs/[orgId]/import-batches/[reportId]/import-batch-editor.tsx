"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ImportBatchData {
  id: string;
  orgId: string;
  title: string | null;
  version: string;
  state: string;
  filename: string;
  rowCount: number;
  notes: string | null;
  sectionsJson: unknown;
  lockedAt: string | null;
  revisionOf: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  batch: ImportBatchData;
  canEdit: boolean;
  isAdmin: boolean;
}

const STATE_ENUM = ["uploaded", "parsing", "validating", "ready_to_commit", "committed", "failed"] as const;

export function ImportBatchEditor({ batch, canEdit, isAdmin }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ImportBatchData>(batch);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLocked = !!data.lockedAt;
  const isEditable = canEdit && !isLocked;

  const debouncedSave = useCallback(
    (newData: ImportBatchData) => {
      if (!isEditable) return;

      setSaveStatus("saving");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          const res = await fetch(`/api/orgs/${data.orgId}/import-batches/${data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newData.title,
              notes: newData.notes,
              sectionsJson: newData.sectionsJson,
            }),
          });

          if (!res.ok) {
            setSaveStatus("error");
            return;
          }

          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("error");
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
    [data.orgId, data.id, isEditable],
  );

  const handleChange = (key: keyof ImportBatchData, value: unknown) => {
    const newData = { ...data, [key]: value };
    setData(newData);
    debouncedSave(newData);
  };

  const handleStateChange = async (newState: string) => {
    if (!isAdmin) {
      alert("Only admins can change state");
      return;
    }

    try {
      const res = await fetch(`/api/orgs/${data.orgId}/import-batches/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: newState }),
      });

      if (!res.ok) {
        alert("Failed to update state");
        return;
      }

      const updated = await res.json();
      setData((prev) => ({ ...prev, ...updated }));
    } catch {
      alert("Error updating state");
    }
  };

  const handleRevise = async () => {
    if (!isAdmin) {
      alert("Only admins can create revisions");
      return;
    }

    try {
      const res = await fetch(`/api/orgs/${data.orgId}/import-batches/${data.id}/revise`, {
        method: "POST",
      });

      if (!res.ok) {
        alert("Failed to create revision");
        return;
      }

      const newBatch = await res.json();
      router.push(`/orgs/${data.orgId}/import-batches/${newBatch.id}`);
    } catch {
      alert("Error creating revision");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 pb-6 border-b">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-semibold mb-2">
              {data.title || data.filename}
            </h1>
            <p className="text-sm text-gray-500">
              v{data.version} • {data.state} • {new Date(data.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            {saveStatus === "saving" && (
              <div className="flex items-center gap-2 text-blue-600">
                <Save className="w-4 h-4" />
                Saving...
              </div>
            )}
            {saveStatus === "saved" && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                Saved
              </div>
            )}
            {saveStatus === "error" && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                Error
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <select
            value={data.state}
            onChange={(e) => handleStateChange(e.target.value)}
            disabled={!isAdmin || isLocked}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {STATE_ENUM.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          {isAdmin && !isLocked && data.state !== "committed" && (
            <Button variant="outline" size="sm" onClick={handleRevise}>
              Create Revision
            </Button>
          )}

          {data.revisionOf && (
            <p className="text-xs text-gray-500">Revision of {data.revisionOf}</p>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Locked since {new Date(data.lockedAt!).toLocaleString()}. Create a revision to make changes.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <fieldset disabled={!isEditable} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filename</label>
              <input
                type="text"
                value={data.filename}
                disabled
                className="w-full px-3 py-2 border rounded-md bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <input
                type="text"
                value={data.title || ""}
                onChange={(e) => handleChange("title", e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Row Count</label>
            <input
              type="number"
              value={data.rowCount}
              disabled
              className="w-full px-3 py-2 border rounded-md bg-gray-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={data.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border rounded-md"
              placeholder="Processing notes, validation results, errors, etc."
            />
          </div>
        </fieldset>

        <div className="pt-6 border-t text-xs text-gray-500 space-y-1">
          <p>File: {data.filename}</p>
        </div>
      </div>
    </div>
  );
}
