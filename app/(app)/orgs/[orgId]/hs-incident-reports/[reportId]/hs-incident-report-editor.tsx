"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Menu, X, Save, AlertCircle, CheckCircle2,
  Plus, Trash2, GripVertical, ChevronDown
} from "lucide-react";

export interface HsReportData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  sectionsJson: unknown;
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

interface Injury {
  id: string;
  name: string;
  role: string;
  injuries: string;
  treatmentLocation: string;
}

interface Witness {
  id: string;
  name: string;
  statement: string;
}

interface HsSections {
  incidentDetails: {
    incidentType: string;
    description: string;
    timeOfIncident: string;
    location: string;
    immediateImpact: string;
  };
  injuredParty: {
    injuries: Injury[];
  };
  immediateResponse: {
    actionsTaken: string;
    emergencyServices: boolean;
    emergencyServicesDetails: string;
    firstAidProvided: string;
  };
  investigation: {
    investigationDate: string;
    rootCause: string;
    contributingFactors: string;
    witnesses: Witness[];
  };
  correctiveActions: {
    immediateMeasures: string;
    longTermMeasures: string;
    assignedTo: string;
    dueDate: string;
  };
  riddor: {
    riddorNotifiable: boolean;
    riddorReportDate: string;
    riddorRefNumber: string;
    hseNotified: boolean;
  };
}

const DEFAULT_SECTIONS: HsSections = {
  incidentDetails: {
    incidentType: "", description: "", timeOfIncident: "",
    location: "", immediateImpact: "",
  },
  injuredParty: { injuries: [] },
  immediateResponse: {
    actionsTaken: "", emergencyServices: false,
    emergencyServicesDetails: "", firstAidProvided: "",
  },
  investigation: {
    investigationDate: "", rootCause: "", contributingFactors: "",
    witnesses: [],
  },
  correctiveActions: {
    immediateMeasures: "", longTermMeasures: "", assignedTo: "",
    dueDate: "",
  },
  riddor: {
    riddorNotifiable: false, riddorReportDate: "",
    riddorRefNumber: "", hseNotified: false,
  },
};

const NAV_SECTIONS = [
  { id: "details", label: "Incident Details" },
  { id: "injured", label: "Injured Party" },
  { id: "response", label: "Immediate Response" },
  { id: "investigation", label: "Investigation" },
  { id: "corrections", label: "Corrective Actions" },
  { id: "riddor", label: "RIDDOR Report" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "Under Review",
  approved: "Approved",
  issued: "Issued",
  signed_off: "Signed Off",
  superseded: "Superseded",
};

function IncidentDetailsSection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Incident Details</h3>
      <div>
        <label className="block text-sm font-medium">Incident Type</label>
        <input
          type="text"
          value={s.incidentDetails.incidentType}
          onChange={(e) => onChange({ ...s, incidentDetails: { ...s.incidentDetails, incidentType: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={s.incidentDetails.description}
          onChange={(e) => onChange({ ...s, incidentDetails: { ...s.incidentDetails, description: e.target.value } })}
          disabled={disabled}
          rows={3}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Time of Incident</label>
        <input
          type="time"
          value={s.incidentDetails.timeOfIncident}
          onChange={(e) => onChange({ ...s, incidentDetails: { ...s.incidentDetails, timeOfIncident: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Location</label>
        <input
          type="text"
          value={s.incidentDetails.location}
          onChange={(e) => onChange({ ...s, incidentDetails: { ...s.incidentDetails, location: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Immediate Impact</label>
        <textarea
          value={s.incidentDetails.immediateImpact}
          onChange={(e) => onChange({ ...s, incidentDetails: { ...s.incidentDetails, immediateImpact: e.target.value } })}
          disabled={disabled}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
    </div>
  );
}

function InjuredPartySection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Injured Party</h3>
        <button
          onClick={() => {
            const newInjury: Injury = { id: Math.random().toString(), name: "", role: "", injuries: "", treatmentLocation: "" };
            onChange({ ...s, injuredParty: { injuries: [...s.injuredParty.injuries, newInjury] } });
          }}
          disabled={disabled}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
        >
          Add Injured Person
        </button>
      </div>
      {s.injuredParty.injuries.map((injury, idx) => (
        <div key={injury.id} className="border rounded p-3 space-y-2">
          <input
            type="text"
            placeholder="Name"
            value={injury.name}
            onChange={(e) => {
              const updated = [...s.injuredParty.injuries];
              updated[idx].name = e.target.value;
              onChange({ ...s, injuredParty: { injuries: updated } });
            }}
            disabled={disabled}
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <input
            type="text"
            placeholder="Role"
            value={injury.role}
            onChange={(e) => {
              const updated = [...s.injuredParty.injuries];
              updated[idx].role = e.target.value;
              onChange({ ...s, injuredParty: { injuries: updated } });
            }}
            disabled={disabled}
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <textarea
            placeholder="Injuries"
            value={injury.injuries}
            onChange={(e) => {
              const updated = [...s.injuredParty.injuries];
              updated[idx].injuries = e.target.value;
              onChange({ ...s, injuredParty: { injuries: updated } });
            }}
            disabled={disabled}
            rows={2}
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <input
            type="text"
            placeholder="Treatment Location"
            value={injury.treatmentLocation}
            onChange={(e) => {
              const updated = [...s.injuredParty.injuries];
              updated[idx].treatmentLocation = e.target.value;
              onChange({ ...s, injuredParty: { injuries: updated } });
            }}
            disabled={disabled}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      ))}
    </div>
  );
}

function ImmediateResponseSection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Immediate Response</h3>
      <div>
        <label className="block text-sm font-medium">Actions Taken</label>
        <textarea
          value={s.immediateResponse.actionsTaken}
          onChange={(e) => onChange({ ...s, immediateResponse: { ...s.immediateResponse, actionsTaken: e.target.value } })}
          disabled={disabled}
          rows={3}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={s.immediateResponse.emergencyServices}
          onChange={(e) => onChange({ ...s, immediateResponse: { ...s.immediateResponse, emergencyServices: e.target.checked } })}
          disabled={disabled}
          className="w-4 h-4"
        />
        <label className="text-sm font-medium">Emergency Services Called</label>
      </div>
      {s.immediateResponse.emergencyServices && (
        <div>
          <label className="block text-sm font-medium">Emergency Services Details</label>
          <textarea
            value={s.immediateResponse.emergencyServicesDetails}
            onChange={(e) => onChange({ ...s, immediateResponse: { ...s.immediateResponse, emergencyServicesDetails: e.target.value } })}
            disabled={disabled}
            rows={2}
            className="w-full mt-1 px-3 py-2 border rounded"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium">First Aid Provided</label>
        <input
          type="text"
          value={s.immediateResponse.firstAidProvided}
          onChange={(e) => onChange({ ...s, immediateResponse: { ...s.immediateResponse, firstAidProvided: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
    </div>
  );
}

function InvestigationSection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Investigation</h3>
        <button
          onClick={() => {
            const newWitness: Witness = { id: Math.random().toString(), name: "", statement: "" };
            onChange({ ...s, investigation: { ...s.investigation, witnesses: [...s.investigation.witnesses, newWitness] } });
          }}
          disabled={disabled}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded"
        >
          Add Witness
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium">Investigation Date</label>
        <input
          type="date"
          value={s.investigation.investigationDate}
          onChange={(e) => onChange({ ...s, investigation: { ...s.investigation, investigationDate: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Root Cause</label>
        <textarea
          value={s.investigation.rootCause}
          onChange={(e) => onChange({ ...s, investigation: { ...s.investigation, rootCause: e.target.value } })}
          disabled={disabled}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Contributing Factors</label>
        <textarea
          value={s.investigation.contributingFactors}
          onChange={(e) => onChange({ ...s, investigation: { ...s.investigation, contributingFactors: e.target.value } })}
          disabled={disabled}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div className="space-y-2">
        <h4 className="font-semibold">Witness Statements</h4>
        {s.investigation.witnesses.map((witness, idx) => (
          <div key={witness.id} className="border rounded p-3 space-y-2">
            <input
              type="text"
              placeholder="Witness Name"
              value={witness.name}
              onChange={(e) => {
                const updated = [...s.investigation.witnesses];
                updated[idx].name = e.target.value;
                onChange({ ...s, investigation: { ...s.investigation, witnesses: updated } });
              }}
              disabled={disabled}
              className="w-full px-2 py-1 border rounded text-sm"
            />
            <textarea
              placeholder="Statement"
              value={witness.statement}
              onChange={(e) => {
                const updated = [...s.investigation.witnesses];
                updated[idx].statement = e.target.value;
                onChange({ ...s, investigation: { ...s.investigation, witnesses: updated } });
              }}
              disabled={disabled}
              rows={2}
              className="w-full px-2 py-1 border rounded text-sm"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function CorrectiveActionsSection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Corrective Actions</h3>
      <div>
        <label className="block text-sm font-medium">Immediate Measures</label>
        <textarea
          value={s.correctiveActions.immediateMeasures}
          onChange={(e) => onChange({ ...s, correctiveActions: { ...s.correctiveActions, immediateMeasures: e.target.value } })}
          disabled={disabled}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Long-term Measures</label>
        <textarea
          value={s.correctiveActions.longTermMeasures}
          onChange={(e) => onChange({ ...s, correctiveActions: { ...s.correctiveActions, longTermMeasures: e.target.value } })}
          disabled={disabled}
          rows={2}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Assigned To</label>
        <input
          type="text"
          value={s.correctiveActions.assignedTo}
          onChange={(e) => onChange({ ...s, correctiveActions: { ...s.correctiveActions, assignedTo: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Due Date</label>
        <input
          type="date"
          value={s.correctiveActions.dueDate}
          onChange={(e) => onChange({ ...s, correctiveActions: { ...s.correctiveActions, dueDate: e.target.value } })}
          disabled={disabled}
          className="w-full mt-1 px-3 py-2 border rounded"
        />
      </div>
    </div>
  );
}

function RiddorSection({ s, onChange, disabled }: { s: HsSections; onChange: (s: HsSections) => void; disabled: boolean }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">RIDDOR Report</h3>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={s.riddor.riddorNotifiable}
          onChange={(e) => onChange({ ...s, riddor: { ...s.riddor, riddorNotifiable: e.target.checked } })}
          disabled={disabled}
          className="w-4 h-4"
        />
        <label className="text-sm font-medium">RIDDOR Notifiable</label>
      </div>
      {s.riddor.riddorNotifiable && (
        <>
          <div>
            <label className="block text-sm font-medium">RIDDOR Report Date</label>
            <input
              type="date"
              value={s.riddor.riddorReportDate}
              onChange={(e) => onChange({ ...s, riddor: { ...s.riddor, riddorReportDate: e.target.value } })}
              disabled={disabled}
              className="w-full mt-1 px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">RIDDOR Reference Number</label>
            <input
              type="text"
              value={s.riddor.riddorRefNumber}
              onChange={(e) => onChange({ ...s, riddor: { ...s.riddor, riddorRefNumber: e.target.value } })}
              disabled={disabled}
              className="w-full mt-1 px-3 py-2 border rounded"
            />
          </div>
        </>
      )}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={s.riddor.hseNotified}
          onChange={(e) => onChange({ ...s, riddor: { ...s.riddor, hseNotified: e.target.checked } })}
          disabled={disabled}
          className="w-4 h-4"
        />
        <label className="text-sm font-medium">HSE Notified</label>
      </div>
    </div>
  );
}

export function HsIncidentReportEditor({
  report,
  projects,
  sites,
  canEdit,
  isAdmin,
}: {
  report: HsReportData;
  projects: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [sections, setSections] = useState<HsSections>(
    (report.sectionsJson as HsSections | null) || DEFAULT_SECTIONS
  );
  const [title, setTitle] = useState(report.title);
  const [projectId, setProjectId] = useState(report.projectId || "");
  const [siteId, setSiteId] = useState(report.siteId || "");
  const [incidentDate, setIncidentDate] = useState(report.incidentDate || "");
  const [status, setStatus] = useState(report.status);
  const [activeNav, setActiveNav] = useState("details");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef<HsSections | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disabled = !canEdit || !!report.lockedAt;

  const autoSave = useCallback(() => {
    if (!canEdit || saveStatus === "saving") return;

    const hasChanges = JSON.stringify(sections) !== JSON.stringify(lastSavedRef.current);
    if (!hasChanges) return;

    setSaveStatus("saving");
    fetch(`/api/orgs/${report.orgId}/hs-incident-reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionsJson: sections, title, projectId, siteId, incidentDate }),
    })
      .then(() => {
        lastSavedRef.current = sections;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(() => setSaveStatus("idle"));
  }, [sections, title, projectId, siteId, incidentDate, canEdit, report.orgId, report.id, saveStatus]);

  const debouncedAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(autoSave, 1500);
  }, [autoSave]);

  useEffect(() => {
    debouncedAutoSave();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [sections, title, projectId, siteId, incidentDate, debouncedAutoSave]);

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;
    await autoSave();
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/hs-incident-reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, sectionsJson: sections }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch (err) {
      console.error("Status change failed:", err);
    }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/hs-incident-reports/${report.id}/revise`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/orgs/${report.orgId}/hs-incident-reports/${data.id}`);
      }
    } catch (err) {
      console.error("Revise failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:flex h-screen">
        {/* Mobile menu toggle */}
        <div className="lg:hidden p-4 bg-white border-b flex items-center justify-between">
          <h1 className="font-bold">{title || "H&S Incident Report"}</h1>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 hover:bg-gray-100 rounded">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        {(mobileMenuOpen || window.innerWidth >= 1024) && (
          <div className="w-full lg:w-64 bg-white border-r border-gray-200 p-4 space-y-2 overflow-y-auto">
            {NAV_SECTIONS.map((sec) => (
              <button
                key={sec.id}
                onClick={() => {
                  setActiveNav(sec.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2 rounded ${
                  activeNav === sec.id ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-gray-100"
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="hidden lg:flex bg-white border-b border-gray-200 p-4 items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{title || "H&S Incident Report"}</h1>
              <p className="text-sm text-gray-600">Version {report.version}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                status === "draft" ? "bg-gray-100 text-gray-700" :
                status === "review" ? "bg-amber-100 text-amber-800" :
                status === "approved" ? "bg-blue-100 text-blue-800" :
                "bg-green-100 text-green-800"
              }`}>
                {STATUS_LABELS[status] || status}
              </span>
              {saveStatus === "saving" && <div className="text-sm text-amber-600">Saving...</div>}
              {saveStatus === "saved" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl space-y-6">
              {/* Metadata */}
              <div className="bg-white rounded-lg border p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={disabled}
                    className="w-full mt-1 px-3 py-2 border rounded"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Project</label>
                    <select
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      disabled={disabled}
                      className="w-full mt-1 px-3 py-2 border rounded"
                    >
                      <option value="">Select a project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Site</label>
                    <select
                      value={siteId}
                      onChange={(e) => setSiteId(e.target.value)}
                      disabled={disabled}
                      className="w-full mt-1 px-3 py-2 border rounded"
                    >
                      <option value="">Select a site</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium">Incident Date</label>
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    disabled={disabled}
                    className="w-full mt-1 px-3 py-2 border rounded"
                  />
                </div>
              </div>

              {/* Status controls */}
              {canEdit && (
                <div className="bg-white rounded-lg border p-4 space-y-2">
                  <p className="text-sm font-medium">Status Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {status === "draft" && (
                      <button
                        onClick={() => handleStatusChange("review")}
                        className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 text-sm"
                      >
                        Submit for Review
                      </button>
                    )}
                    {status === "review" && isAdmin && (
                      <>
                        <button
                          onClick={() => handleStatusChange("approved")}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange("draft")}
                          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {status === "approved" && isAdmin && (
                      <button
                        onClick={() => handleStatusChange("issued")}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        Issue
                      </button>
                    )}
                    {(status === "approved" || status === "issued") && !report.lockedAt && (
                      <button
                        onClick={handleRevise}
                        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                      >
                        Create Revision
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Section content */}
              <div className="bg-white rounded-lg border p-6">
                {activeNav === "details" && <IncidentDetailsSection s={sections} onChange={setSections} disabled={disabled} />}
                {activeNav === "injured" && <InjuredPartySection s={sections} onChange={setSections} disabled={disabled} />}
                {activeNav === "response" && <ImmediateResponseSection s={sections} onChange={setSections} disabled={disabled} />}
                {activeNav === "investigation" && <InvestigationSection s={sections} onChange={setSections} disabled={disabled} />}
                {activeNav === "corrections" && <CorrectiveActionsSection s={sections} onChange={setSections} disabled={disabled} />}
                {activeNav === "riddor" && <RiddorSection s={sections} onChange={setSections} disabled={disabled} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
