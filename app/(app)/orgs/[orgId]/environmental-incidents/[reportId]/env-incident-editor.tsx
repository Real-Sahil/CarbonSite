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
                  <div>
                    <label className="block text-sm font-medium mb-1">Report Title</label>
                    <Input
                      disabled={disabled}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Incident title"
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
                      <label className="block text-sm font-medium mb-1">Incident Date</label>
                      <Input
                        disabled={disabled}
                        type="date"
                        value={incidentDate}
                        onChange={(e) => setIncidentDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Incident Type</label>
                      <Input
                        disabled={disabled}
                        value={sections.incidentType || ""}
                        onChange={(e) =>
                          setSections({ ...sections, incidentType: e.target.value })
                        }
                        placeholder="e.g., Chemical Spill, Noise Complaint"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Textarea
                      disabled={disabled}
                      value={sections.description || ""}
                      onChange={(e) =>
                        setSections({ ...sections, description: e.target.value })
                      }
                      placeholder="Describe the environmental incident"
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Location</label>
                    <Input
                      disabled={disabled}
                      value={sections.location || ""}
                      onChange={(e) => setSections({ ...sections, location: e.target.value })}
                      placeholder="Specific location of incident"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Severity</label>
                    <Select
                      disabled={disabled}
                      value={sections.severity || ""}
                      onValueChange={(v) => setSections({ ...sections, severity: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Environmental Impact */}
            {activeNav === "impact" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Environmental Impact</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Impact Type</label>
                    <Input
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Affected Areas</label>
                    <Textarea
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estimated Damage</label>
                    <Input
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
                  </div>
                </div>
              </div>
            )}

            {/* Response */}
            {activeNav === "response" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Response Actions</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Immediate Actions Taken</label>
                    <Textarea
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Notifications Required</label>
                    <Input
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Containment Measures</label>
                    <Textarea
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
                  </div>
                </div>
              </div>
            )}

            {/* Investigation */}
            {activeNav === "investigation" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Investigation</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Investigation Date</label>
                    <Input
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Root Cause</label>
                    <Textarea
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Contributing Factors</label>
                    <Textarea
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
                  </div>
                </div>
              </div>
            )}

            {/* Remediation */}
            {activeNav === "remediation" && (
              <div className="bg-white p-6 rounded-lg border">
                <h2 className="text-lg font-semibold mb-4">Remediation</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Remediation Plan</label>
                    <Textarea
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
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Estimated Cost</label>
                    <Input
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Target Completion</label>
                      <Input
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
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Responsible Party</label>
                      <Input
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
                    </div>
                  </div>
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
