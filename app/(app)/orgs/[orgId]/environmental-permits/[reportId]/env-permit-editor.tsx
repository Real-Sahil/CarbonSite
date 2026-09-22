"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

interface PermitSection {
  permitNumber?: string;
  permitType?: string;
  regulatoryBody?: string;
  activities?: string;
  conditions?: string;
  renewalProcess?: string;
}

interface PermitData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  sectionsJson: PermitSection | null;
  permitDate: string | null;
  expiryDate: string | null;
  lockedAt: string | null;
  revisionOf: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null } | null;
  signedOffBy: { id: string; name: string | null } | null;
  project: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

interface DropdownOption {
  id: string;
  name: string;
}

interface Props {
  permit: PermitData;
  projects: DropdownOption[];
  sites: DropdownOption[];
  canEdit: boolean;
  isAdmin: boolean;
}

export function EnvironmentalPermitEditor({
  permit: initialPermit,
  projects,
  sites,
  canEdit,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialPermit.title);
  const [projectId, setProjectId] = useState(initialPermit.projectId || "");
  const [siteId, setSiteId] = useState(initialPermit.siteId || "");
  const [permitDate, setPermitDate] = useState(initialPermit.permitDate || "");
  const [expiryDate, setExpiryDate] = useState(initialPermit.expiryDate || "");
  const [sections, setSections] = useState<PermitSection>(
    initialPermit.sectionsJson || {}
  );
  const [status, setStatus] = useState(initialPermit.status);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify(sections));

  const autoSave = useCallback(async () => {
    if (JSON.stringify(sections) === lastSavedRef.current && status === initialPermit.status) {
      return;
    }

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialPermit.orgId}/environmental-permits/${initialPermit.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            projectId: projectId || null,
            siteId: siteId || null,
            permitDate: permitDate || null,
            expiryDate: expiryDate || null,
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
  }, [sections, status, title, projectId, siteId, permitDate, expiryDate, initialPermit]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || initialPermit.lockedAt) return;
    return debouncedAutoSave();
  }, [sections, title, projectId, siteId, permitDate, expiryDate, debouncedAutoSave, canEdit, initialPermit.lockedAt]);

  const handleStatusChange = async (newStatus: string) => {
    await autoSave();
    setStatus(newStatus);

    try {
      const res = await fetch(
        `/api/orgs/${initialPermit.orgId}/environmental-permits/${initialPermit.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Status update failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setStatus(initialPermit.status);
    }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(
        `/api/orgs/${initialPermit.orgId}/environmental-permits/${initialPermit.id}/revise`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Revise failed");
      const newPermit = await res.json();
      router.push(
        `/orgs/${initialPermit.orgId}/environmental-permits/${newPermit.id}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revise failed");
    }
  };

  const disabled = !canEdit || !!initialPermit.lockedAt;
  const showRevise = ["approved", "issued", "signed_off"].includes(status) && canEdit;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title || "Untitled"}</h1>
            <p className="text-sm text-gray-600">v{initialPermit.version}</p>
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

      {initialPermit.lockedAt && (
        <div className="max-w-4xl mx-auto px-4 py-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          Locked at {new Date(initialPermit.lockedAt).toLocaleString()}. Create a new revision to edit.
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Permit Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Permit Title</label>
                <Input
                  disabled={disabled}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Permit title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Project</label>
                  <Select
                    disabled={disabled}
                    value={projectId}
                    onValueChange={setProjectId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Site</label>
                  <Select disabled={disabled} value={siteId} onValueChange={setSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Permit Date</label>
                  <Input
                    disabled={disabled}
                    type="date"
                    value={permitDate}
                    onChange={(e) => setPermitDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expiry Date</label>
                  <Input
                    disabled={disabled}
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permit Number</label>
                <Input
                  disabled={disabled}
                  value={sections.permitNumber || ""}
                  onChange={(e) =>
                    setSections({ ...sections, permitNumber: e.target.value })
                  }
                  placeholder="Permit reference number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permit Type</label>
                <Input
                  disabled={disabled}
                  value={sections.permitType || ""}
                  onChange={(e) =>
                    setSections({ ...sections, permitType: e.target.value })
                  }
                  placeholder="e.g., Environmental Permit, Waste Management"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Regulatory Body</label>
                <Input
                  disabled={disabled}
                  value={sections.regulatoryBody || ""}
                  onChange={(e) =>
                    setSections({ ...sections, regulatoryBody: e.target.value })
                  }
                  placeholder="e.g., Environment Agency"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Permitted Activities</label>
                <Textarea
                  disabled={disabled}
                  value={sections.activities || ""}
                  onChange={(e) => setSections({ ...sections, activities: e.target.value })}
                  placeholder="List all permitted activities"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Conditions & Limits</label>
                <Textarea
                  disabled={disabled}
                  value={sections.conditions || ""}
                  onChange={(e) => setSections({ ...sections, conditions: e.target.value })}
                  placeholder="Specify conditions and limits"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Renewal Process</label>
                <Textarea
                  disabled={disabled}
                  value={sections.renewalProcess || ""}
                  onChange={(e) => setSections({ ...sections, renewalProcess: e.target.value })}
                  placeholder="Describe renewal timeline and process"
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
