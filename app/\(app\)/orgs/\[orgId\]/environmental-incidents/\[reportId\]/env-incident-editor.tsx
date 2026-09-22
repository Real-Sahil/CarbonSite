"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, CheckCircle2 } from "lucide-react";

export interface EnvIncidentData {
  id: string; orgId: string; title: string; version: string; status: string; projectId: string | null; siteId: string | null;
  sectionsJson: unknown; incidentDate: string | null; lockedAt: string | null; revisionOf: string | null;
  createdAt: string; updatedAt: string; createdBy: { id: string; name: string | null } | null;
  signedOffBy: { id: string; name: string | null } | null; project: { id: string; name: string } | null; site: { id: string; name: string } | null;
}

interface Sections {
  incidentDetails: { incidentType: string; description: string; location: string; timeOfIncident: string };
  environmental_impact: { impactType: string; affectedAreas: string; severity: string };
  response: { actionsTaken: string; notificationsIssued: string; cleanupRequired: string };
  investigation: { rootCause: string; contributingFactors: string };
  remediation: { immediateMeasures: string; longTermMeasures: string; dueDate: string };
}

const DEFAULT_SECTIONS: Sections = {
  incidentDetails: { incidentType: "", description: "", location: "", timeOfIncident: "" },
  environmental_impact: { impactType: "", affectedAreas: "", severity: "" },
  response: { actionsTaken: "", notificationsIssued: "", cleanupRequired: "" },
  investigation: { rootCause: "", contributingFactors: "" },
  remediation: { immediateMeasures: "", longTermMeasures: "", dueDate: "" },
};

const NAV_SECTIONS = [
  { id: "details", label: "Incident Details" },
  { id: "impact", label: "Environmental Impact" },
  { id: "response", label: "Response" },
  { id: "investigation", label: "Investigation" },
  { id: "remediation", label: "Remediation" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", review: "Under Review", approved: "Approved", issued: "Issued", signed_off: "Signed Off", superseded: "Superseded",
};

export function EnvironmentalIncidentEditor({
  report, projects, sites, canEdit, isAdmin,
}: {
  report: EnvIncidentData; projects: { id: string; name: string }[]; sites: { id: string; name: string }[];
  canEdit: boolean; isAdmin: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<Sections>((report.sectionsJson as Sections | null) || DEFAULT_SECTIONS);
  const [title, setTitle] = useState(report.title);
  const [projectId, setProjectId] = useState(report.projectId || "");
  const [siteId, setSiteId] = useState(report.siteId || "");
  const [status, setStatus] = useState(report.status);
  const [activeNav, setActiveNav] = useState("details");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef<Sections | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disabled = !canEdit || !!report.lockedAt;

  const autoSave = useCallback(() => {
    if (!canEdit || saveStatus === "saving") return;
    const hasChanges = JSON.stringify(sections) !== JSON.stringify(lastSavedRef.current);
    if (!hasChanges) return;

    setSaveStatus("saving");
    fetch(`/api/orgs/${report.orgId}/environmental-incidents/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionsJson: sections, title, projectId, siteId }),
    })
      .then(() => {
        lastSavedRef.current = sections;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(() => setSaveStatus("idle"));
  }, [sections, title, projectId, siteId, canEdit, report.orgId, report.id, saveStatus]);

  const debouncedAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(autoSave, 1500);
  }, [autoSave]);

  useEffect(() => {
    debouncedAutoSave();
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [sections, title, projectId, siteId, debouncedAutoSave]);

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;
    await autoSave();
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/environmental-incidents/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, sectionsJson: sections }),
      });
      if (res.ok) setStatus(newStatus);
    } catch (err) {
      console.error("Status change failed:", err);
    }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/environmental-incidents/${report.id}/revise`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/orgs/${report.orgId}/environmental-incidents/${data.id}`);
      }
    } catch (err) {
      console.error("Revise failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:flex h-screen">
        <div className="lg:hidden p-4 bg-white border-b flex items-center justify-between">
          <h1 className="font-bold">{title || "Environmental Incident"}</h1>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-gray-100 rounded">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {(mobileMenuOpen || window.innerWidth >= 1024) && (
          <div className="w-full lg:w-64 bg-white border-r border-gray-200 p-4 space-y-2 overflow-y-auto">
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => { setActiveNav(sec.id); setMobileMenuOpen(false); }}
                className={`w-full text-left px-4 py-2 rounded ${activeNav === sec.id ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-gray-100"}`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden lg:flex bg-white border-b border-gray-200 p-4 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{title || "Environmental Incident"}</h1>
              <p className="text-sm text-gray-600">Version {report.version}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${status === "draft" ? "bg-gray-100 text-gray-700" : status === "review" ? "bg-amber-100 text-amber-800" : status === "approved" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                {STATUS_LABELS[status] || status}
              </span>
              {saveStatus === "saving" && <div className="text-sm text-amber-600">Saving...</div>}
              {saveStatus === "saved" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl space-y-6">
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} className="w-full mt-1 px-3 py-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Project</label>
                    <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={disabled} className="w-full mt-1 px-3 py-2 border rounded">
                      <option value="">Select</option>
                      {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Site</label>
                    <select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={disabled} className="w-full mt-1 px-3 py-2 border rounded">
                      <option value="">Select</option>
                      {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                    </select>
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="bg-white rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-medium">Status Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {status === "draft" && <button onClick={() => handleStatusChange("review")} className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm">Submit for Review</button>}
                    {status === "review" && isAdmin && (
                      <>
                        <button onClick={() => handleStatusChange("approved")} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Approve</button>
                        <button onClick={() => handleStatusChange("draft")} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">Reject</button>
                      </>
                    )}
                    {status === "approved" && isAdmin && <button onClick={() => handleStatusChange("issued")} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">Issue</button>}
                    {(status === "approved" || status === "issued") && !report.lockedAt && <button onClick={handleRevise} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm">Create Revision</button>}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-lg border p-6">
                {activeNav === "details" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Incident Details</h3>
                    <input type="text" placeholder="Incident Type" value={sections.incidentDetails.incidentType} onChange={(e) => setSections({ ...sections, incidentDetails: { ...sections.incidentDetails, incidentType: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Description" value={sections.incidentDetails.description} onChange={(e) => setSections({ ...sections, incidentDetails: { ...sections.incidentDetails, description: e.target.value } })} disabled={disabled} rows={3} className="w-full px-3 py-2 border rounded" />
                    <input type="text" placeholder="Location" value={sections.incidentDetails.location} onChange={(e) => setSections({ ...sections, incidentDetails: { ...sections.incidentDetails, location: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                    <input type="time" value={sections.incidentDetails.timeOfIncident} onChange={(e) => setSections({ ...sections, incidentDetails: { ...sections.incidentDetails, timeOfIncident: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {activeNav === "impact" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Environmental Impact</h3>
                    <input type="text" placeholder="Impact Type" value={sections.environmental_impact.impactType} onChange={(e) => setSections({ ...sections, environmental_impact: { ...sections.environmental_impact, impactType: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Affected Areas" value={sections.environmental_impact.affectedAreas} onChange={(e) => setSections({ ...sections, environmental_impact: { ...sections.environmental_impact, affectedAreas: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <input type="text" placeholder="Severity (Low/Medium/High)" value={sections.environmental_impact.severity} onChange={(e) => setSections({ ...sections, environmental_impact: { ...sections.environmental_impact, severity: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {activeNav === "response" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Response</h3>
                    <textarea placeholder="Actions Taken" value={sections.response.actionsTaken} onChange={(e) => setSections({ ...sections, response: { ...sections.response, actionsTaken: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Notifications Issued" value={sections.response.notificationsIssued} onChange={(e) => setSections({ ...sections, response: { ...sections.response, notificationsIssued: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Cleanup Required" value={sections.response.cleanupRequired} onChange={(e) => setSections({ ...sections, response: { ...sections.response, cleanupRequired: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {activeNav === "investigation" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Investigation</h3>
                    <textarea placeholder="Root Cause" value={sections.investigation.rootCause} onChange={(e) => setSections({ ...sections, investigation: { ...sections.investigation, rootCause: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Contributing Factors" value={sections.investigation.contributingFactors} onChange={(e) => setSections({ ...sections, investigation: { ...sections.investigation, contributingFactors: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
                {activeNav === "remediation" && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Remediation</h3>
                    <textarea placeholder="Immediate Measures" value={sections.remediation.immediateMeasures} onChange={(e) => setSections({ ...sections, remediation: { ...sections.remediation, immediateMeasures: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <textarea placeholder="Long-term Measures" value={sections.remediation.longTermMeasures} onChange={(e) => setSections({ ...sections, remediation: { ...sections.remediation, longTermMeasures: e.target.value } })} disabled={disabled} rows={2} className="w-full px-3 py-2 border rounded" />
                    <input type="date" value={sections.remediation.dueDate} onChange={(e) => setSections({ ...sections, remediation: { ...sections.remediation, dueDate: e.target.value } })} disabled={disabled} className="w-full px-3 py-2 border rounded" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
