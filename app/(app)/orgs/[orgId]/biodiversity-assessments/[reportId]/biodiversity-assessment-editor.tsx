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

interface AssessmentSection {
  habitatType?: string;
  siteBoundary?: string;
  baselineCondition?: string;
  speciesIdentified?: string;
  protectedSpecies?: string;
  riskAssessment?: string;
  mitigationMeasures?: string;
  monitoringPlan?: string;
}

interface AssessmentData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  sectionsJson: AssessmentSection | null;
  assessmentDate: string | null;
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
  assessment: AssessmentData;
  projects: DropdownOption[];
  sites: DropdownOption[];
  canEdit: boolean;
  isAdmin: boolean;
}

export function BiodiversityAssessmentEditor({
  assessment: initialAssessment,
  projects,
  sites,
  canEdit,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialAssessment.title);
  const [projectId, setProjectId] = useState(initialAssessment.projectId || "");
  const [siteId, setSiteId] = useState(initialAssessment.siteId || "");
  const [assessmentDate, setAssessmentDate] = useState(initialAssessment.assessmentDate || "");
  const [sections, setSections] = useState<AssessmentSection>(
    initialAssessment.sectionsJson || {}
  );
  const [status, setStatus] = useState(initialAssessment.status);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify(sections));

  const autoSave = useCallback(async () => {
    if (JSON.stringify(sections) === lastSavedRef.current && status === initialAssessment.status) {
      return;
    }

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialAssessment.orgId}/biodiversity-assessments/${initialAssessment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            projectId: projectId || null,
            siteId: siteId || null,
            assessmentDate: assessmentDate || null,
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
  }, [sections, status, title, projectId, siteId, assessmentDate, initialAssessment]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || initialAssessment.lockedAt) return;
    return debouncedAutoSave();
  }, [sections, title, projectId, siteId, assessmentDate, debouncedAutoSave, canEdit, initialAssessment.lockedAt]);

  const handleStatusChange = async (newStatus: string) => {
    await autoSave();
    setStatus(newStatus);

    try {
      const res = await fetch(
        `/api/orgs/${initialAssessment.orgId}/biodiversity-assessments/${initialAssessment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!res.ok) throw new Error("Status update failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setStatus(initialAssessment.status);
    }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(
        `/api/orgs/${initialAssessment.orgId}/biodiversity-assessments/${initialAssessment.id}/revise`,
        { method: "POST" }
      );

      if (!res.ok) throw new Error("Revise failed");
      const newAssessment = await res.json();
      router.push(
        `/orgs/${initialAssessment.orgId}/biodiversity-assessments/${newAssessment.id}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revise failed");
    }
  };

  const disabled = !canEdit || !!initialAssessment.lockedAt;
  const showRevise = ["approved", "issued", "signed_off"].includes(status) && canEdit;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title || "Untitled"}</h1>
            <p className="text-sm text-gray-600">v{initialAssessment.version}</p>
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

      {initialAssessment.lockedAt && (
        <div className="max-w-4xl mx-auto px-4 py-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          Locked at {new Date(initialAssessment.lockedAt).toLocaleString()}. Create a new revision to edit.
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Biodiversity Assessment Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Assessment Title</label>
                <Input
                  disabled={disabled}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Biodiversity assessment title"
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
              <div>
                <label className="block text-sm font-medium mb-1">Assessment Date</label>
                <Input
                  disabled={disabled}
                  type="date"
                  value={assessmentDate}
                  onChange={(e) => setAssessmentDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Habitat Type</label>
                <Input
                  disabled={disabled}
                  value={sections.habitatType || ""}
                  onChange={(e) => setSections({ ...sections, habitatType: e.target.value })}
                  placeholder="e.g., Woodland, Grassland, Wetland"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Site Boundary & Area</label>
                <Textarea
                  disabled={disabled}
                  value={sections.siteBoundary || ""}
                  onChange={(e) => setSections({ ...sections, siteBoundary: e.target.value })}
                  placeholder="Define site boundary, area (hectares), coordinates"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Baseline Condition</label>
                <Textarea
                  disabled={disabled}
                  value={sections.baselineCondition || ""}
                  onChange={(e) => setSections({ ...sections, baselineCondition: e.target.value })}
                  placeholder="Current ecological condition and habitats present"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Species Identified</label>
                <Textarea
                  disabled={disabled}
                  value={sections.speciesIdentified || ""}
                  onChange={(e) => setSections({ ...sections, speciesIdentified: e.target.value })}
                  placeholder="Flora and fauna species found on site"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Protected Species & Habitats</label>
                <Textarea
                  disabled={disabled}
                  value={sections.protectedSpecies || ""}
                  onChange={(e) => setSections({ ...sections, protectedSpecies: e.target.value })}
                  placeholder="List any protected species or designated habitats"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Risk Assessment</label>
                <Textarea
                  disabled={disabled}
                  value={sections.riskAssessment || ""}
                  onChange={(e) => setSections({ ...sections, riskAssessment: e.target.value })}
                  placeholder="Potential impacts on biodiversity from activities"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Mitigation Measures</label>
                <Textarea
                  disabled={disabled}
                  value={sections.mitigationMeasures || ""}
                  onChange={(e) => setSections({ ...sections, mitigationMeasures: e.target.value })}
                  placeholder="Proposed mitigation and enhancement measures"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Monitoring Plan</label>
                <Textarea
                  disabled={disabled}
                  value={sections.monitoringPlan || ""}
                  onChange={(e) => setSections({ ...sections, monitoringPlan: e.target.value })}
                  placeholder="Long-term monitoring and management strategy"
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
