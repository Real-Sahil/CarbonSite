"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

interface BatchSection {
  sourceFile?: string;
  recordCount?: string;
  dataType?: string;
  period?: string;
  importNotes?: string;
  validationSummary?: string;
  errorSummary?: string;
}

interface BatchData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  sectionsJson: BatchSection | null;
  lockedAt: string | null;
  revisionOf: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null } | null;
  signedOffBy: { id: string; name: string | null } | null;
}

interface Props {
  batch: BatchData;
  canEdit: boolean;
  isAdmin: boolean;
}

export function ImportBatchEditor({
  batch: initialBatch,
  canEdit,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialBatch.title);
  const [sections, setSections] = useState<BatchSection>(
    initialBatch.sectionsJson || {}
  );
  const [status, setStatus] = useState(initialBatch.status);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify(sections));

  const autoSave = useCallback(async () => {
    if (JSON.stringify(sections) === lastSavedRef.current && status === initialBatch.status) {
      return;
    }

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialBatch.orgId}/import-batches/${initialBatch.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            sectionsJson: sections,
            status,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Save failed");
      }

      lastSavedRef.current = JSON.stringify(sections);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("idle");
    }
  }, [sections, status, title, initialBatch]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || initialBatch.lockedAt) return;
    return debouncedAutoSave();
  }, [sections, title, debouncedAutoSave, canEdit, initialBatch.lockedAt]);

  const handleStatusChange = async (newStatus: string) => {
    await autoSave();
    setStatus(newStatus);

    try {
      const res = await fetch(
        `/api/orgs/${initialBatch.orgId}/import-batches/${initialBatch.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Status update failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setStatus(initialBatch.status);
    }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(
        `/api/orgs/${initialBatch.orgId}/import-batches/${initialBatch.id}/revise`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Revise failed");
      const newBatch = await res.json();
      router.push(
        `/orgs/${initialBatch.orgId}/import-batches/${newBatch.id}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revise failed");
    }
  };

  const disabled = !canEdit || !!initialBatch.lockedAt;
  const showRevise = ["approved", "issued", "signed_off"].includes(status) && canEdit;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title || "Untitled"}</h1>
            <p className="text-sm text-gray-600">v{initialBatch.version}</p>
          </div>
          <div className="flex gap-2">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1 text-sm text-green-600">✓ Saved</span>
            )}
            <Badge variant={status === "draft" ? "secondary" : "default"}>{status}</Badge>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4 py-4 bg-red-50 border border-red-200 rounded flex gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {initialBatch.lockedAt && (
        <div className="max-w-4xl mx-auto px-4 py-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          Locked at {new Date(initialBatch.lockedAt).toLocaleString()}. Create a new revision to edit.
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Import Batch Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Batch Title</label>
                <Input
                  disabled={disabled}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Import batch title or description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Source File</label>
                  <Input
                    disabled={disabled}
                    value={sections.sourceFile || ""}
                    onChange={(e) => setSections({ ...sections, sourceFile: e.target.value })}
                    placeholder="e.g., emissions_q2_2025.csv"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Record Count</label>
                  <Input
                    disabled={disabled}
                    type="number"
                    value={sections.recordCount || ""}
                    onChange={(e) => setSections({ ...sections, recordCount: e.target.value })}
                    placeholder="Number of records"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Data Type</label>
                  <Input
                    disabled={disabled}
                    value={sections.dataType || ""}
                    onChange={(e) => setSections({ ...sections, dataType: e.target.value })}
                    placeholder="e.g., Emission Records, Facility Data"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Reporting Period</label>
                  <Input
                    disabled={disabled}
                    value={sections.period || ""}
                    onChange={(e) => setSections({ ...sections, period: e.target.value })}
                    placeholder="e.g., 2025-Q2, Jan-Mar 2025"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Import Notes</label>
                <Textarea
                  disabled={disabled}
                  value={sections.importNotes || ""}
                  onChange={(e) => setSections({ ...sections, importNotes: e.target.value })}
                  placeholder="Any notes about the import process, data source, or special handling"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Validation Summary</label>
                <Textarea
                  disabled={disabled}
                  value={sections.validationSummary || ""}
                  onChange={(e) => setSections({ ...sections, validationSummary: e.target.value })}
                  placeholder="Summary of validation checks passed"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Error Summary</label>
                <Textarea
                  disabled={disabled}
                  value={sections.errorSummary || ""}
                  onChange={(e) => setSections({ ...sections, errorSummary: e.target.value })}
                  placeholder="Any errors encountered during import, validation issues, or corrections made"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Status Transitions */}
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Status & Actions</h2>
            <div className="flex flex-wrap gap-2">
              {status === "draft" && (
                <Button
                  onClick={() => handleStatusChange("submitted_for_review")}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Submit for Review
                </Button>
              )}
              {status === "submitted_for_review" && isAdmin && (
                <>
                  <Button
                    onClick={() => handleStatusChange("approved")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve
                  </Button>
                  <Button variant="outline" onClick={() => handleStatusChange("draft")}>
                    Request Changes
                  </Button>
                </>
              )}
              {status === "approved" && isAdmin && (
                <Button
                  onClick={() => handleStatusChange("issued")}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Issue
                </Button>
              )}
              {showRevise && (
                <Button
                  onClick={handleRevise}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Create New Revision
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
