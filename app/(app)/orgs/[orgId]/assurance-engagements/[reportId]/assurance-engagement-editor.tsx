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
import { FormField, FormSection } from "@/components/forms/form-kit";

interface EngagementSection {
  assuranceType?: string;
  assuranceLevel?: string;
  assurer?: string;
  scope?: string;
  methodology?: string;
  dataReviewed?: string;
  keyFindings?: string;
  conclusions?: string;
  recommendations?: string;
}

interface EngagementData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  sectionsJson: EngagementSection | null;
  engagementDate: string | null;
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
  engagement: EngagementData;
  projects: DropdownOption[];
  sites: DropdownOption[];
  canEdit: boolean;
  isAdmin: boolean;
}

export function AssuranceEngagementEditor({
  engagement: initialEngagement,
  projects,
  sites,
  canEdit,
  isAdmin,
}: Props) {
  const [title, setTitle] = useState(initialEngagement.title);
  const [projectId, setProjectId] = useState(initialEngagement.projectId || "");
  const [siteId, setSiteId] = useState(initialEngagement.siteId || "");
  const [engagementDate, setEngagementDate] = useState(initialEngagement.engagementDate || "");
  const [sections, setSections] = useState<EngagementSection>(
    initialEngagement.sectionsJson || {}
  );
  const status = initialEngagement.status;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const lastSavedRef = useRef(JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, engagementDate: engagementDate || null, sectionsJson: sections }));

  const autoSave = useCallback(async () => {
    const payload = JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, engagementDate: engagementDate || null, sectionsJson: sections });
    if (payload === lastSavedRef.current) return;

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialEngagement.orgId}/assurance-engagements/${initialEngagement.id}`,
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
  }, [sections, title, projectId, siteId, engagementDate, initialEngagement]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || isLockedStatus("assurance-engagements", status)) return;
    return debouncedAutoSave();
  }, [sections, title, projectId, siteId, engagementDate, debouncedAutoSave, canEdit, status]);

  const disabled = !canEdit || isLockedStatus("assurance-engagements", status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title || "Untitled"}</h1>
            <p className="text-sm text-gray-600">v{initialEngagement.version}</p>
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
            <StatusBadge form="assurance-engagements" status={status} />
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
        <LockNotice form="assurance-engagements" status={status} />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form className="space-y-6">
          <div className="bg-white p-6 rounded-lg border">
            <h2 className="text-lg font-semibold mb-4">Assurance Engagement Details</h2>
            <div className="space-y-4">
              <FormField label="Engagement Title" htmlFor="f-engagement-title">
                <Input id="f-engagement-title"
                  disabled={disabled}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Assurance engagement title"
                />
              </FormField>
              <FormSection cols={2}>
                <FormField label="Project" htmlFor="f-project">
                  <Select
                    disabled={disabled}
                    value={projectId}
                    onValueChange={setProjectId}
                  >
                    <SelectTrigger id="f-project">
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
                </FormField>
                <FormField label="Site" htmlFor="f-site">
                  <Select disabled={disabled} value={siteId} onValueChange={setSiteId}>
                    <SelectTrigger id="f-site">
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
                </FormField>
              </FormSection>
              <FormSection cols={2}>
                <FormField label="Engagement Date" htmlFor="f-engagement-date">
                  <Input id="f-engagement-date"
                    disabled={disabled}
                    type="date"
                    value={engagementDate}
                    onChange={(e) => setEngagementDate(e.target.value)}
                  />
                </FormField>
                <FormField label="Assurance Type" htmlFor="f-assurance-type">
                  <Select
                    disabled={disabled}
                    value={sections.assuranceType || ""}
                    onValueChange={(v) => setSections({ ...sections, assuranceType: v })}
                  >
                    <SelectTrigger id="f-assurance-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="limited">Limited Assurance</SelectItem>
                      <SelectItem value="reasonable">Reasonable Assurance</SelectItem>
                      <SelectItem value="agreed-upon-procedures">Agreed-Upon Procedures</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </FormSection>
              <FormSection cols={2}>
                <FormField label="Assurance Level" htmlFor="f-assurance-level">
                  <Input id="f-assurance-level"
                    disabled={disabled}
                    value={sections.assuranceLevel || ""}
                    onChange={(e) =>
                      setSections({ ...sections, assuranceLevel: e.target.value })
                    }
                    placeholder="e.g., ISAE 3000, AA1000"
                  />
                </FormField>
                <FormField label="Assurer" htmlFor="f-assurer">
                  <Input id="f-assurer"
                    disabled={disabled}
                    value={sections.assurer || ""}
                    onChange={(e) => setSections({ ...sections, assurer: e.target.value })}
                    placeholder="Assurance provider name"
                  />
                </FormField>
              </FormSection>
              <FormField label="Scope" htmlFor="f-scope">
                <Textarea id="f-scope"
                  disabled={disabled}
                  value={sections.scope || ""}
                  onChange={(e) => setSections({ ...sections, scope: e.target.value })}
                  placeholder="Scope of the assurance engagement"
                  rows={3}
                />
              </FormField>
              <FormField label="Methodology" htmlFor="f-methodology">
                <Textarea id="f-methodology"
                  disabled={disabled}
                  value={sections.methodology || ""}
                  onChange={(e) => setSections({ ...sections, methodology: e.target.value })}
                  placeholder="Assurance methodology and standards applied"
                  rows={3}
                />
              </FormField>
              <FormField label="Data Reviewed" htmlFor="f-data-reviewed">
                <Textarea id="f-data-reviewed"
                  disabled={disabled}
                  value={sections.dataReviewed || ""}
                  onChange={(e) => setSections({ ...sections, dataReviewed: e.target.value })}
                  placeholder="Description of data and systems reviewed"
                  rows={3}
                />
              </FormField>
              <FormField label="Key Findings" htmlFor="f-key-findings">
                <Textarea id="f-key-findings"
                  disabled={disabled}
                  value={sections.keyFindings || ""}
                  onChange={(e) => setSections({ ...sections, keyFindings: e.target.value })}
                  placeholder="Key findings from the assurance engagement"
                  rows={3}
                />
              </FormField>
              <FormField label="Conclusions" htmlFor="f-conclusions">
                <Textarea id="f-conclusions"
                  disabled={disabled}
                  value={sections.conclusions || ""}
                  onChange={(e) => setSections({ ...sections, conclusions: e.target.value })}
                  placeholder="Overall conclusions and opinions"
                  rows={3}
                />
              </FormField>
              <FormField label="Recommendations" htmlFor="f-recommendations">
                <Textarea id="f-recommendations"
                  disabled={disabled}
                  value={sections.recommendations || ""}
                  onChange={(e) => setSections({ ...sections, recommendations: e.target.value })}
                  placeholder="Recommendations for improvement"
                  rows={3}
                />
              </FormField>
            </div>
          </div>

          <WorkflowBar
            form="assurance-engagements"
            orgId={initialEngagement.orgId}
            id={initialEngagement.id}
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
