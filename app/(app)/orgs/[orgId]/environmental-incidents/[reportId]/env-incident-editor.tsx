"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import { LockNotice, StatusBadge, WorkflowBar } from "@/components/structured-forms/workflow-bar";
import { isLockedStatus } from "@/lib/structured-forms/workflows";
import { AlertCircle, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { FormField, FormSection } from "@/components/forms/form-kit";

interface EnvIncidentSection {
  incidentType?: string;
  description?: string;
  timeOfIncident?: string;
  location?: string;
  severity?: string;
  environmentalImpact?: {
    impactType?: string;
    affectedAreas?: string;
    estimatedDamage?: string;
  };
  responseActions?: {
    immediateActions?: string;
    notificationsRequired?: string;
    containmentMeasures?: string;
  };
  investigation?: {
    investigationDate?: string;
    rootCause?: string;
    contributingFactors?: string;
  };
  remediation?: {
    remediationPlan?: string;
    estimatedCost?: string;
    targetCompletionDate?: string;
    responsibleParty?: string;
  };
}

interface EnvIncidentData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  sectionsJson: EnvIncidentSection | null;
  incidentDate: string | null;
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
  report: EnvIncidentData;
  projects: DropdownOption[];
  sites: DropdownOption[];
  canEdit: boolean;
  isAdmin: boolean;
}

export function EnvironmentalIncidentEditor({
  report: initialReport,
  projects,
  sites,
  canEdit,
  isAdmin,
}: Props) {
  const [title, setTitle] = useState(initialReport.title);
  const [projectId, setProjectId] = useState(initialReport.projectId || "");
  const [siteId, setSiteId] = useState(initialReport.siteId || "");
  const [incidentDate, setIncidentDate] = useState(initialReport.incidentDate || "");
  const [sections, setSections] = useState<EnvIncidentSection>(
    initialReport.sectionsJson || {}
  );
  const status = initialReport.status;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("details");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastSavedRef = useRef(JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, incidentDate: incidentDate || null, sectionsJson: sections }));

  const NAV_SECTIONS = [
    { id: "details", label: "Incident Details" },
    { id: "impact", label: "Environmental Impact" },
    { id: "response", label: "Response" },
    { id: "investigation", label: "Investigation" },
    { id: "remediation", label: "Remediation" },
  ];

  const autoSave = useCallback(async () => {
    const payload = JSON.stringify({ title, projectId: projectId || null, siteId: siteId || null, incidentDate: incidentDate || null, sectionsJson: sections });
    if (payload === lastSavedRef.current) return;

    setSaveStatus("saving");
    setError(null);

    try {
      const res = await fetch(
        `/api/orgs/${initialReport.orgId}/environmental-incidents/${initialReport.id}`,
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
  }, [sections, title, projectId, siteId, incidentDate, initialReport]);

  const debouncedAutoSave = useCallback(() => {
    const timer = setTimeout(autoSave, 1500);
    return () => clearTimeout(timer);
  }, [autoSave]);

  useEffect(() => {
    if (!canEdit || isLockedStatus("environmental-incidents", status)) return;
    return debouncedAutoSave();
  }, [sections, title, projectId, siteId, incidentDate, debouncedAutoSave, canEdit, status]);

  const disabled = !canEdit || isLockedStatus("environmental-incidents", status);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{title || "Untitled"}</h1>
            <p className="text-sm text-gray-600">v{initialReport.version}</p>
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
            <StatusBadge form="environmental-incidents" status={status} />
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 py-4 bg-red-50 border border-red-200 rounded flex gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 pt-4">
        <LockNotice form="environmental-incidents" status={status} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <nav className="lg:col-span-1">
          <div className="lg:hidden mb-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-2" /> Hide sections
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-2" /> Show sections
                </>
              )}
            </Button>
          </div>
          {(
            <div className={`space-y-2 ${mobileMenuOpen ? "block" : "hidden"} lg:block`}>
              {NAV_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveNav(section.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded font-medium transition-colors ${
                    activeNav === section.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="lg:col-span-3">
          <form className="space-y-6">
            {/* Incident Details */}
            {activeNav === "details" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Incident Details</h2>
                <div className="space-y-4">
                  <FormField label="Report Title" htmlFor="f-report-title">
                    <Input id="f-report-title"
                      disabled={disabled}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Incident title"
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
                    <FormField label="Incident Date" htmlFor="f-incident-date">
                      <Input id="f-incident-date"
                        disabled={disabled}
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </FormField>
                    <FormField label="Incident Type" htmlFor="f-incident-type">
                      <Input id="f-incident-type"
                        disabled={disabled}
                        value={sections.incidentType || ""}
                        onChange={(e) =>
                          setSections({ ...sections, incidentType: e.target.value })
                        }
                        placeholder="e.g., Chemical Spill, Noise Complaint"
                      />
                    </FormField>
                  </FormSection>
                  <FormField label="Description" htmlFor="f-description">
                    <Textarea id="f-description"
                      disabled={disabled}
                      value={sections.description || ""}
                      onChange={(e) =>
                        setSections({ ...sections, description: e.target.value })
                      }
                      placeholder="Describe the environmental incident"
                      rows={4}
                    />
                  </FormField>
                  <FormField label="Location" htmlFor="f-location">
                    <Input id="f-location"
                      disabled={disabled}
                      value={sections.location || ""}
                      onChange={(e) => setSections({ ...sections, location: e.target.value })}
                      placeholder="Specific location of incident"
                    />
                  </FormField>
                  <FormField label="Severity" htmlFor="f-severity">
                    <Select
                      disabled={disabled}
                      value={sections.severity || ""}
                      onValueChange={(v) => setSections({ ...sections, severity: v })}
                    >
                      <SelectTrigger id="f-severity">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </div>
            )}

            {/* Environmental Impact */}
            {activeNav === "impact" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Environmental Impact</h2>
                <div className="space-y-4">
                  <FormField label="Impact Type" htmlFor="f-impact-type">
                    <Input id="f-impact-type"
                      disabled={disabled}
                      value={sections.environmentalImpact?.impactType || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          environmentalImpact: {
                            ...sections.environmentalImpact,
                            impactType: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g., Water pollution, Air emissions"
                    />
                  </FormField>
                  <FormField label="Affected Areas" htmlFor="f-affected-areas">
                    <Textarea id="f-affected-areas"
                      disabled={disabled}
                      value={sections.environmentalImpact?.affectedAreas || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          environmentalImpact: {
                            ...sections.environmentalImpact,
                            affectedAreas: e.target.value,
                          },
                        })
                      }
                      placeholder="Describe affected areas"
                      rows={3}
                    />
                  </FormField>
                  <FormField label="Estimated Damage" htmlFor="f-estimated-damage">
                    <Input id="f-estimated-damage"
                      disabled={disabled}
                      value={sections.environmentalImpact?.estimatedDamage || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          environmentalImpact: {
                            ...sections.environmentalImpact,
                            estimatedDamage: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g., Estimated cost, extent"
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Response */}
            {activeNav === "response" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Response Actions</h2>
                <div className="space-y-4">
                  <FormField label="Immediate Actions Taken" htmlFor="f-immediate-actions-taken">
                    <Textarea id="f-immediate-actions-taken"
                      disabled={disabled}
                      value={sections.responseActions?.immediateActions || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          responseActions: {
                            ...sections.responseActions,
                            immediateActions: e.target.value,
                          },
                        })
                      }
                      placeholder="What immediate steps were taken?"
                      rows={3}
                    />
                  </FormField>
                  <FormField label="Notifications Required" htmlFor="f-notifications-required">
                    <Input id="f-notifications-required"
                      disabled={disabled}
                      value={sections.responseActions?.notificationsRequired || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          responseActions: {
                            ...sections.responseActions,
                            notificationsRequired: e.target.value,
                          },
                        })
                      }
                      placeholder="e.g., Environment Agency, Local Council"
                    />
                  </FormField>
                  <FormField label="Containment Measures" htmlFor="f-containment-measures">
                    <Textarea id="f-containment-measures"
                      disabled={disabled}
                      value={sections.responseActions?.containmentMeasures || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          responseActions: {
                            ...sections.responseActions,
                            containmentMeasures: e.target.value,
                          },
                        })
                      }
                      placeholder="Describe containment/prevention measures"
                      rows={3}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Investigation */}
            {activeNav === "investigation" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Investigation</h2>
                <div className="space-y-4">
                  <FormField label="Investigation Date" htmlFor="f-investigation-date">
                    <Input id="f-investigation-date"
                      disabled={disabled}
                      type="date"
                      value={sections.investigation?.investigationDate || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          investigation: {
                            ...sections.investigation,
                            investigationDate: e.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="Root Cause" htmlFor="f-root-cause">
                    <Textarea id="f-root-cause"
                      disabled={disabled}
                      value={sections.investigation?.rootCause || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          investigation: {
                            ...sections.investigation,
                            rootCause: e.target.value,
                          },
                        })
                      }
                      placeholder="Identified root cause"
                      rows={3}
                    />
                  </FormField>
                  <FormField label="Contributing Factors" htmlFor="f-contributing-factors">
                    <Textarea id="f-contributing-factors"
                      disabled={disabled}
                      value={sections.investigation?.contributingFactors || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          investigation: {
                            ...sections.investigation,
                            contributingFactors: e.target.value,
                          },
                        })
                      }
                      placeholder="List contributing factors"
                      rows={3}
                    />
                  </FormField>
                </div>
              </div>
            )}

            {/* Remediation */}
            {activeNav === "remediation" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Remediation</h2>
                <div className="space-y-4">
                  <FormField label="Remediation Plan" htmlFor="f-remediation-plan">
                    <Textarea id="f-remediation-plan"
                      disabled={disabled}
                      value={sections.remediation?.remediationPlan || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          remediation: {
                            ...sections.remediation,
                            remediationPlan: e.target.value,
                          },
                        })
                      }
                      placeholder="Detailed remediation plan"
                      rows={4}
                    />
                  </FormField>
                  <FormField label="Estimated Cost" htmlFor="f-estimated-cost">
                    <Input id="f-estimated-cost"
                      disabled={disabled}
                      type="number"
                      value={sections.remediation?.estimatedCost || ""}
                      onChange={(e) =>
                        setSections({
                          ...sections,
                          remediation: {
                            ...sections.remediation,
                            estimatedCost: e.target.value,
                          },
                        })
                      }
                      placeholder="Cost in GBP"
                    />
                  </FormField>
                  <FormSection cols={2}>
                    <FormField label="Target Completion" htmlFor="f-target-completion">
                      <Input id="f-target-completion"
                        disabled={disabled}
                        type="date"
                        value={sections.remediation?.targetCompletionDate || ""}
                        onChange={(e) =>
                          setSections({
                            ...sections,
                            remediation: {
                              ...sections.remediation,
                              targetCompletionDate: e.target.value,
                            },
                          })
                        }
                      />
                    </FormField>
                    <FormField label="Responsible Party" htmlFor="f-responsible-party">
                      <Input id="f-responsible-party"
                        disabled={disabled}
                        value={sections.remediation?.responsibleParty || ""}
                        onChange={(e) =>
                          setSections({
                            ...sections,
                            remediation: {
                              ...sections.remediation,
                              responsibleParty: e.target.value,
                            },
                          })
                        }
                        placeholder="Name/Department"
                      />
                    </FormField>
                  </FormSection>
                </div>
              </div>
            )}
          </form>

          <div className="mt-6">
            <WorkflowBar
              form="environmental-incidents"
              orgId={initialReport.orgId}
              id={initialReport.id}
              status={status}
              canEdit={canEdit}
              isAdmin={isAdmin}
              beforeChange={autoSave}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
