"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LockNotice, StatusBadge, WorkflowBar } from "@/components/structured-forms/workflow-bar";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import { AlertCircle, Loader2 } from "lucide-react";

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
  const [title, setTitle] = useState(initialPermit.title);
  const [projectId, setProjectId] = useState(initialPermit.projectId || "");
  const [siteId, setSiteId] = useState(initialPermit.siteId || "");
  const [permitDate, setPermitDate] = useState(initialPermit.permitDate || "");
  const [expiryDate, setExpiryDate] = useState(initialPermit.expiryDate || "");
  const [sections, setSections] = useState<PermitSection>(
    initialPermit.sectionsJson || {}
  );
  const status = initialPermit.status;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, permitDate: permitDate || null, expiryDate: expiryDate || null, sectionsJson: sections }));

  const autoSave = useCallback(async () => {
    const payload = JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, permitDate: permitDate || null, expiryDate: expiryDate || null, sectionsJson: sections });
    if (payload === lastSavedRef.current) return;

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialPermit.orgId}/environmental-permits/${initialPermit.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: payload,
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Save failed");
      }

      lastSavedRef.current = payload;
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveStatus("idle");
    }
  }, [sections, title, projectId, siteId, permitDate, expiryDate, initialPermit]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || isLockedStatus("environmental-permits", status)) return;
    return debouncedAutoSave();
  }, [sections, title, projectId, siteId, permitDate, expiryDate, debouncedAutoSave, canEdit, status]);

  const disabled = !canEdit || isLockedStatus("environmental-permits", status);

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
            <StatusBadge form="environmental-permits" status={status} />
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto px-4 py-4 bg-red-50 border border-red-200 rounded flex gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-4">
        <LockNotice form="environmental-permits" status={status} />
      </div>

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

          <WorkflowBar
            form="environmental-permits"
            orgId={initialPermit.orgId}
            id={initialPermit.id}
            status={status}
            canEdit={canEdit}
            isAdmin={isAdmin}
            beforeChange={autoSave}
          />
        </form>
      </div>
    </div>
  );
}
