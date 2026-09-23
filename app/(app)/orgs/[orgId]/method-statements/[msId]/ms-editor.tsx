"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, ChevronRight, Menu, X, Save, AlertCircle, CheckCircle2,
  Plus, Trash2, Copy, Printer
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MsData {
  id: string;
  orgId: string;
  title: string;
  version: string;
  status: string;
  projectId: string | null;
  siteId: string | null;
  riskAssessmentText: string | null;
  methodText: string | null;
  ppeRequired: string | null;
  sectionsJson: unknown;
  issuedAt: string | null;
  expiresAt: string | null;
  lockedAt: string | null;
  revisionOf: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null } | null;
  signedOffBy: { id: string; name: string | null } | null;
  project: { id: string; name: string } | null;
  site: { id: string; name: string } | null;
}

interface WorkStep {
  id: string;
  order: number;
  description: string;
  responsibleParty: string;
  precautions: string;
}

interface Hazard {
  id: string;
  description: string;
  personsAtRisk: string;
  initialRisk: "low" | "medium" | "high";
  controls: string;
  residualRisk: "low" | "medium" | "high";
}

interface EmergencyContact {
  id: string;
  name: string;
  role: string;
  phone: string;
}

interface EquipmentItem {
  id: string;
  name: string;
  quantity: string;
  certRequired: boolean;
}

interface MsSections {
  details: {
    supervisorName: string;
    workLocation: string;
    startDate: string;
    endDate: string;
    duration: string;
    operativesCount: string;
    contractRef: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  };
  scope: {
    workDescription: string;
    inclusions: string;
    exclusions: string;
    limitations: string;
    workHours: string;
  };
  resources: {
    ppeItems: string[];
    equipment: EquipmentItem[];
    competencies: string[];
  };
  riskControls: {
    hazards: Hazard[];
    permits: string[];
  };
  sequence: {
    workSteps: WorkStep[];
  };
  envEmergency: {
    environmentalControls: string[];
    wasteDisposal: string;
    emergencyProcedure: string;
    assemblyPoint: string;
    emergencyContacts: EmergencyContact[];
    firstAidProvision: string;
  };
  review: {
    reviewerNotes: string;
    approvalConditions: string;
    nextReviewDate: string;
    issueDate: string;
    expiryDate: string;
  };
}

const DEFAULT_SECTIONS: MsSections = {
  details: {
    supervisorName: "", workLocation: "", startDate: "", endDate: "",
    duration: "", operativesCount: "", contractRef: "",
    emergencyContactName: "", emergencyContactPhone: "",
  },
  scope: { workDescription: "", inclusions: "", exclusions: "", limitations: "", workHours: "" },
  resources: { ppeItems: [], equipment: [], competencies: [] },
  riskControls: { hazards: [], permits: [] },
  sequence: { workSteps: [] },
  envEmergency: {
    environmentalControls: [], wasteDisposal: "", emergencyProcedure: "",
    assemblyPoint: "", emergencyContacts: [], firstAidProvision: "",
  },
  review: { reviewerNotes: "", approvalConditions: "", nextReviewDate: "", issueDate: "", expiryDate: "" },
};

const PPE_OPTIONS = [
  "Hard hat", "Hi-vis vest", "Safety boots (S3)", "Gloves - general",
  "Gloves - chemical", "Safety glasses", "Face shield",
  "Hearing protection", "Dust mask (FFP2)", "Dust mask (FFP3)", "Half-face RPE",
  "Safety harness / lanyard", "Waterproof clothing", "Hi-vis waterproof",
  "First aid kit on site", "Other",
];

const COMPETENCY_OPTIONS = [
  "CSCS card", "IPAF licence", "PASMA card", "CPCS card",
  "Asbestos awareness (CAT A)", "Manual handling",
  "Working at height", "First aid at work", "Emergency first aid",
  "Confined space entry", "Abrasive wheels", "Slinger / banksman",
  "Fork-lift truck", "Other",
];

const PERMIT_OPTIONS = [
  "Hot work permit", "Confined space permit", "Excavation permit",
  "Working at height permit", "Electrical isolation permit",
  "Gas isolation permit", "Lone worker permit", "Environmental permit", "Other",
];

const ENV_CONTROL_OPTIONS = [
  "Dust suppression (water / barriers)", "Noise control measures",
  "Waste segregation (general / hazardous)", "Spill kit on site",
  "COSHH assessment in place", "Water pollution prevention",
  "Sediment control", "Air quality monitoring", "Other",
];

const RISK_LEVELS = ["low", "medium", "high"] as const;

const NAV_SECTIONS = [
  { key: "details", label: "Details" },
  { key: "scope", label: "Scope" },
  { key: "resources", label: "Resources" },
  { key: "riskControls", label: "Risk & Controls" },
  { key: "sequence", label: "Sequence" },
  { key: "envEmergency", label: "Env & Emergency" },
  { key: "review", label: "Review" },
] as const;

type SectionKey = typeof NAV_SECTIONS[number]["key"];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:      { label: "Draft",      cls: "bg-gray-100 text-gray-700" },
  review:     { label: "Review",     cls: "bg-amber-100 text-amber-800" },
  approved:   { label: "Approved",   cls: "bg-blue-100 text-blue-800" },
  issued:     { label: "Issued",     cls: "bg-green-100 text-green-800" },
  signed_off: { label: "Signed off", cls: "bg-green-100 text-green-800" },
  superseded: { label: "Superseded", cls: "bg-gray-100 text-gray-500" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nanoid8() {
  return Math.random().toString(36).slice(2, 10);
}

function parseSections(raw: unknown): MsSections {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_SECTIONS);
  const r = raw as Partial<MsSections>;
  return {
    details: { ...DEFAULT_SECTIONS.details, ...(r.details ?? {}) },
    scope: { ...DEFAULT_SECTIONS.scope, ...(r.scope ?? {}) },
    resources: {
      ppeItems: Array.isArray(r.resources?.ppeItems) ? r.resources.ppeItems : [],
      equipment: Array.isArray(r.resources?.equipment) ? r.resources.equipment : [],
      competencies: Array.isArray(r.resources?.competencies) ? r.resources.competencies : [],
    },
    riskControls: {
      hazards: Array.isArray(r.riskControls?.hazards) ? r.riskControls.hazards : [],
      permits: Array.isArray(r.riskControls?.permits) ? r.riskControls.permits : [],
    },
    sequence: {
      workSteps: Array.isArray(r.sequence?.workSteps) ? r.sequence.workSteps : [],
    },
    envEmergency: {
      environmentalControls: Array.isArray(r.envEmergency?.environmentalControls) ? r.envEmergency.environmentalControls : [],
      wasteDisposal: r.envEmergency?.wasteDisposal ?? "",
      emergencyProcedure: r.envEmergency?.emergencyProcedure ?? "",
      assemblyPoint: r.envEmergency?.assemblyPoint ?? "",
      emergencyContacts: Array.isArray(r.envEmergency?.emergencyContacts) ? r.envEmergency.emergencyContacts : [],
      firstAidProvision: r.envEmergency?.firstAidProvision ?? "",
    },
    review: { ...DEFAULT_SECTIONS.review, ...(r.review ?? {}) },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputCls = "w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-300 disabled:opacity-50 disabled:bg-gray-50";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";
const textareaCls = `${inputCls} resize-none`;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function CheckGroup({
  label, options, selected, onChange, disabled,
}: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void; disabled: boolean;
}) {
  return (
    <div>
      <p className={labelCls}>{label} <span className="font-normal text-gray-400">(Select all that apply)</span></p>
      <div className="grid grid-cols-2 gap-1 mt-1">
        {options.map((opt) => (
          <label key={opt} className={`flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1 hover:bg-gray-50 ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
            <input type="checkbox" className="h-3.5 w-3.5 accent-gray-800"
              checked={selected.includes(opt)}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.checked) onChange([...selected, opt]);
                else onChange(selected.filter((v) => v !== opt));
              }} />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: string }) {
  const cls = level === "high" ? "bg-red-100 text-red-700"
    : level === "medium" ? "bg-amber-100 text-amber-700"
    : "bg-green-100 text-green-700";
  return <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>{level}</span>;
}

// ─── Section Renderers ────────────────────────────────────────────────────────

function DetailsSection({ s, ms, projects, sites, onChange, onTopChange, disabled }: {
  s: MsSections["details"];
  ms: { title: string; version: string; projectId: string | null; siteId: string | null };
  projects: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  onChange: (next: MsSections["details"]) => void;
  onTopChange: (patch: { title?: string; version?: string; projectId?: string | null; siteId?: string | null }) => void;
  disabled: boolean;
}) {
  const set = (k: keyof typeof s, v: string) => onChange({ ...s, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Document title *">
          <input className={inputCls} disabled={disabled} value={ms.title}
            onChange={(e) => onTopChange({ title: e.target.value })} />
        </FieldRow>
        <FieldRow label="Version">
          <input className={inputCls} disabled={true} value={ms.version} readOnly />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Project">
          <select className={inputCls} disabled={disabled} value={ms.projectId ?? ""}
            onChange={(e) => onTopChange({ projectId: e.target.value || null })}>
            <option value="">No project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FieldRow>
        <FieldRow label="Site">
          <select className={inputCls} disabled={disabled} value={ms.siteId ?? ""}
            onChange={(e) => onTopChange({ siteId: e.target.value || null })}>
            <option value="">No site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Supervisor / responsible person">
          <input className={inputCls} disabled={disabled} value={s.supervisorName}
            onChange={(e) => set("supervisorName", e.target.value)} />
        </FieldRow>
        <FieldRow label="Work location / address">
          <input className={inputCls} disabled={disabled} value={s.workLocation}
            onChange={(e) => set("workLocation", e.target.value)} />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Start date">
          <input type="date" className={inputCls} disabled={disabled} value={s.startDate}
            onChange={(e) => set("startDate", e.target.value)} />
        </FieldRow>
        <FieldRow label="End date">
          <input type="date" className={inputCls} disabled={disabled} value={s.endDate}
            onChange={(e) => set("endDate", e.target.value)} />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Duration">
          <input className={inputCls} disabled={disabled} value={s.duration} placeholder="3 days"
            onChange={(e) => set("duration", e.target.value)} />
        </FieldRow>
        <FieldRow label="No. of operatives">
          <input type="number" min={1} className={inputCls} disabled={disabled} value={s.operativesCount}
            onChange={(e) => set("operativesCount", e.target.value)} />
        </FieldRow>
      </div>
      <FieldRow label="Contract / purchase order reference">
        <input className={inputCls} disabled={disabled} value={s.contractRef}
          onChange={(e) => set("contractRef", e.target.value)} />
      </FieldRow>
      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Emergency contact name">
          <input className={inputCls} disabled={disabled} value={s.emergencyContactName}
            onChange={(e) => set("emergencyContactName", e.target.value)} />
        </FieldRow>
        <FieldRow label="Emergency contact phone">
          <input type="tel" className={inputCls} disabled={disabled} value={s.emergencyContactPhone}
            onChange={(e) => set("emergencyContactPhone", e.target.value)} />
        </FieldRow>
      </div>
    </div>
  );
}

function ScopeSection({ s, onChange, disabled }: {
  s: MsSections["scope"]; onChange: (n: MsSections["scope"]) => void; disabled: boolean;
}) {
  const set = (k: keyof typeof s, v: string) => onChange({ ...s, [k]: v });
  return (
    <div className="space-y-4">
      <FieldRow label="Description of works *">
        <textarea className={textareaCls} rows={4} disabled={disabled} value={s.workDescription}
          onChange={(e) => set("workDescription", e.target.value)}
          placeholder="Describe the works to be carried out..." />
      </FieldRow>
      <FieldRow label="Inclusions (what is in scope)">
        <textarea className={textareaCls} rows={3} disabled={disabled} value={s.inclusions}
          onChange={(e) => set("inclusions", e.target.value)} />
      </FieldRow>
      <FieldRow label="Exclusions (what is out of scope)">
        <textarea className={textareaCls} rows={3} disabled={disabled} value={s.exclusions}
          onChange={(e) => set("exclusions", e.target.value)} />
      </FieldRow>
      <FieldRow label="Limitations / assumptions">
        <textarea className={textareaCls} rows={2} disabled={disabled} value={s.limitations}
          onChange={(e) => set("limitations", e.target.value)} />
      </FieldRow>
      <FieldRow label="Planned working hours">
        <input className={inputCls} disabled={disabled} value={s.workHours} placeholder="07:00 – 17:00 Mon – Fri"
          onChange={(e) => set("workHours", e.target.value)} />
      </FieldRow>
    </div>
  );
}

function ResourcesSection({ s, onChange, disabled }: {
  s: MsSections["resources"]; onChange: (n: MsSections["resources"]) => void; disabled: boolean;
}) {
  function addEquipment() {
    onChange({ ...s, equipment: [...s.equipment, { id: nanoid8(), name: "", quantity: "1", certRequired: false }] });
  }
  function setEquip(id: string, k: keyof EquipmentItem, v: string | boolean) {
    onChange({ ...s, equipment: s.equipment.map((e) => e.id === id ? { ...e, [k]: v } : e) });
  }
  function delEquip(id: string) {
    onChange({ ...s, equipment: s.equipment.filter((e) => e.id !== id) });
  }
  return (
    <div className="space-y-6">
      <CheckGroup label="PPE required" options={PPE_OPTIONS} selected={s.ppeItems}
        onChange={(v) => onChange({ ...s, ppeItems: v })} disabled={disabled} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={labelCls}>Plant & equipment</p>
          {!disabled && (
            <button type="button" onClick={addEquipment}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
              <Plus className="h-3 w-3" /> Add item
            </button>
          )}
        </div>
        {s.equipment.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No equipment added.</p>
        ) : (
          <div className="space-y-2">
            {s.equipment.map((eq) => (
              <div key={eq.id} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-center">
                <input className={inputCls} disabled={disabled} value={eq.name} placeholder="Equipment / plant name"
                  onChange={(e) => setEquip(eq.id, "name", e.target.value)} />
                <input type="number" min={1} className={inputCls} disabled={disabled} value={eq.quantity} placeholder="Qty"
                  onChange={(e) => setEquip(eq.id, "quantity", e.target.value)} />
                <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-gray-800" disabled={disabled}
                    checked={eq.certRequired} onChange={(e) => setEquip(eq.id, "certRequired", e.target.checked)} />
                  Cert required
                </label>
                {!disabled && (
                  <button type="button" onClick={() => delEquip(eq.id)}
                    className="h-7 w-7 rounded hover:bg-red-50 flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <CheckGroup label="Competency requirements" options={COMPETENCY_OPTIONS} selected={s.competencies}
        onChange={(v) => onChange({ ...s, competencies: v })} disabled={disabled} />
    </div>
  );
}

function RiskControlsSection({ s, onChange, disabled }: {
  s: MsSections["riskControls"]; onChange: (n: MsSections["riskControls"]) => void; disabled: boolean;
}) {
  function addHazard() {
    const h: Hazard = { id: nanoid8(), description: "", personsAtRisk: "", initialRisk: "medium", controls: "", residualRisk: "low" };
    onChange({ ...s, hazards: [...s.hazards, h] });
  }
  function setHazard(id: string, k: keyof Hazard, v: string) {
    onChange({ ...s, hazards: s.hazards.map((h) => h.id === id ? { ...h, [k]: v } : h) });
  }
  function delHazard(id: string) {
    onChange({ ...s, hazards: s.hazards.filter((h) => h.id !== id) });
  }
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={labelCls}>Hazard register</p>
          {!disabled && (
            <button type="button" onClick={addHazard}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
              <Plus className="h-3 w-3" /> Add hazard
            </button>
          )}
        </div>
        {s.hazards.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No hazards recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {s.hazards.map((h, idx) => (
              <div key={h.id} className="rounded border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hazard {idx + 1}</span>
                  {!disabled && (
                    <button type="button" onClick={() => delHazard(h.id)} className="hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5 text-gray-300" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Hazard description *">
                    <input className={inputCls} disabled={disabled} value={h.description}
                      onChange={(e) => setHazard(h.id, "description", e.target.value)} />
                  </FieldRow>
                  <FieldRow label="Persons at risk">
                    <input className={inputCls} disabled={disabled} value={h.personsAtRisk}
                      onChange={(e) => setHazard(h.id, "personsAtRisk", e.target.value)} placeholder="Operatives, public..." />
                  </FieldRow>
                </div>
                <FieldRow label="Control measures">
                  <textarea className={textareaCls} rows={2} disabled={disabled} value={h.controls}
                    onChange={(e) => setHazard(h.id, "controls", e.target.value)} />
                </FieldRow>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Initial risk (Select one)">
                    <div className="flex gap-3 mt-1">
                      {RISK_LEVELS.map((l) => (
                        <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" className="accent-gray-800" disabled={disabled}
                            checked={h.initialRisk === l}
                            onChange={() => setHazard(h.id, "initialRisk", l)} />
                          <RiskBadge level={l} />
                        </label>
                      ))}
                    </div>
                  </FieldRow>
                  <FieldRow label="Residual risk (Select one)">
                    <div className="flex gap-3 mt-1">
                      {RISK_LEVELS.map((l) => (
                        <label key={l} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <input type="radio" className="accent-gray-800" disabled={disabled}
                            checked={h.residualRisk === l}
                            onChange={() => setHazard(h.id, "residualRisk", l)} />
                          <RiskBadge level={l} />
                        </label>
                      ))}
                    </div>
                  </FieldRow>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CheckGroup label="Permits required" options={PERMIT_OPTIONS} selected={s.permits}
        onChange={(v) => onChange({ ...s, permits: v })} disabled={disabled} />
    </div>
  );
}

function SequenceSection({ s, onChange, disabled }: {
  s: MsSections["sequence"]; onChange: (n: MsSections["sequence"]) => void; disabled: boolean;
}) {
  function addStep() {
    const step: WorkStep = {
      id: nanoid8(), order: s.workSteps.length + 1,
      description: "", responsibleParty: "", precautions: "",
    };
    onChange({ workSteps: [...s.workSteps, step] });
  }
  function setStep(id: string, k: keyof WorkStep, v: string) {
    onChange({ workSteps: s.workSteps.map((st) => st.id === id ? { ...st, [k]: v } : st) });
  }
  function delStep(id: string) {
    const remaining = s.workSteps.filter((st) => st.id !== id).map((st, i) => ({ ...st, order: i + 1 }));
    onChange({ workSteps: remaining });
  }
  function dupStep(id: string) {
    const idx = s.workSteps.findIndex((st) => st.id === id);
    if (idx === -1) return;
    const copy = { ...s.workSteps[idx]!, id: nanoid8(), order: s.workSteps.length + 1 };
    const next = [...s.workSteps.slice(0, idx + 1), copy, ...s.workSteps.slice(idx + 1)].map((st, i) => ({ ...st, order: i + 1 }));
    onChange({ workSteps: next });
  }
  function moveStep(id: string, dir: -1 | 1) {
    const idx = s.workSteps.findIndex((st) => st.id === id);
    if (idx + dir < 0 || idx + dir >= s.workSteps.length) return;
    const arr = [...s.workSteps];
    [arr[idx], arr[idx + dir]] = [arr[idx + dir]!, arr[idx]!];
    onChange({ workSteps: arr.map((st, i) => ({ ...st, order: i + 1 })) });
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={labelCls}>Work sequence steps</p>
        {!disabled && (
          <button type="button" onClick={addStep}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
            <Plus className="h-3 w-3" /> Add step
          </button>
        )}
      </div>
      {s.workSteps.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No steps added. Use + Add step to build the sequence.</p>
      ) : (
        <div className="space-y-3">
          {s.workSteps.map((step, idx) => (
            <div key={step.id} className="rounded border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-6 w-6 rounded-full bg-gray-100 text-xs font-semibold text-gray-600 flex items-center justify-center flex-shrink-0">{step.order}</span>
                {!disabled && (
                  <div className="flex gap-1 ml-auto">
                    <button type="button" onClick={() => moveStep(step.id, -1)} disabled={idx === 0}
                      className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center disabled:opacity-30">
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveStep(step.id, 1)} disabled={idx === s.workSteps.length - 1}
                      className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center disabled:opacity-30">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => dupStep(step.id)}
                      className="h-6 w-6 rounded hover:bg-gray-100 flex items-center justify-center">
                      <Copy className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                    <button type="button" onClick={() => delStep(step.id)}
                      className="h-6 w-6 rounded hover:bg-red-50 flex items-center justify-center">
                      <Trash2 className="h-3.5 w-3.5 text-gray-300 hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <FieldRow label="Step description *">
                  <textarea className={textareaCls} rows={2} disabled={disabled} value={step.description}
                    onChange={(e) => setStep(step.id, "description", e.target.value)}
                    placeholder="Describe what will be done..." />
                </FieldRow>
                <div className="grid grid-cols-2 gap-3">
                  <FieldRow label="Responsible party">
                    <input className={inputCls} disabled={disabled} value={step.responsibleParty}
                      onChange={(e) => setStep(step.id, "responsibleParty", e.target.value)}
                      placeholder="Foreman / operative" />
                  </FieldRow>
                  <FieldRow label="Precautions / controls">
                    <input className={inputCls} disabled={disabled} value={step.precautions}
                      onChange={(e) => setStep(step.id, "precautions", e.target.value)} />
                  </FieldRow>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnvEmergencySection({ s, onChange, disabled }: {
  s: MsSections["envEmergency"]; onChange: (n: MsSections["envEmergency"]) => void; disabled: boolean;
}) {
  const set = (k: keyof typeof s, v: string) => onChange({ ...s, [k]: v });
  function addContact() {
    onChange({ ...s, emergencyContacts: [...s.emergencyContacts, { id: nanoid8(), name: "", role: "", phone: "" }] });
  }
  function setContact(id: string, k: keyof EmergencyContact, v: string) {
    onChange({ ...s, emergencyContacts: s.emergencyContacts.map((c) => c.id === id ? { ...c, [k]: v } : c) });
  }
  function delContact(id: string) {
    onChange({ ...s, emergencyContacts: s.emergencyContacts.filter((c) => c.id !== id) });
  }
  return (
    <div className="space-y-6">
      <CheckGroup label="Environmental controls" options={ENV_CONTROL_OPTIONS} selected={s.environmentalControls}
        onChange={(v) => onChange({ ...s, environmentalControls: v })} disabled={disabled} />

      <FieldRow label="Waste disposal arrangements">
        <textarea className={textareaCls} rows={2} disabled={disabled} value={s.wasteDisposal}
          onChange={(e) => set("wasteDisposal", e.target.value)} />
      </FieldRow>

      <FieldRow label="Emergency procedure">
        <textarea className={textareaCls} rows={4} disabled={disabled} value={s.emergencyProcedure}
          onChange={(e) => set("emergencyProcedure", e.target.value)}
          placeholder="In the event of an incident: raise alarm, evacuate, call 999..." />
      </FieldRow>

      <div className="grid grid-cols-2 gap-4">
        <FieldRow label="Assembly point">
          <input className={inputCls} disabled={disabled} value={s.assemblyPoint}
            onChange={(e) => set("assemblyPoint", e.target.value)} />
        </FieldRow>
        <FieldRow label="First aid provision">
          <input className={inputCls} disabled={disabled} value={s.firstAidProvision}
            onChange={(e) => set("firstAidProvision", e.target.value)}
            placeholder="First aider on site: name / phone" />
        </FieldRow>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={labelCls}>Emergency contacts</p>
          {!disabled && (
            <button type="button" onClick={addContact}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1">
              <Plus className="h-3 w-3" /> Add contact
            </button>
          )}
        </div>
        {s.emergencyContacts.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No emergency contacts added.</p>
        ) : (
          <div className="space-y-2">
            {s.emergencyContacts.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_1fr_1fr_32px] gap-2 items-center">
                <input className={inputCls} disabled={disabled} value={c.name} placeholder="Name"
                  onChange={(e) => setContact(c.id, "name", e.target.value)} />
                <input className={inputCls} disabled={disabled} value={c.role} placeholder="Role"
                  onChange={(e) => setContact(c.id, "role", e.target.value)} />
                <input type="tel" className={inputCls} disabled={disabled} value={c.phone} placeholder="Phone"
                  onChange={(e) => setContact(c.id, "phone", e.target.value)} />
                {!disabled && (
                  <button type="button" onClick={() => delContact(c.id)}
                    className="h-7 w-7 rounded hover:bg-red-50 flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewSection({ s, onChange, disabled }: {
  s: MsSections["review"]; onChange: (n: MsSections["review"]) => void; disabled: boolean;
}) {
  const set = (k: keyof typeof s, v: string) => onChange({ ...s, [k]: v });
  return (
    <div className="space-y-4">
      <FieldRow label="Reviewer notes">
        <textarea className={textareaCls} rows={4} disabled={disabled} value={s.reviewerNotes}
          onChange={(e) => set("reviewerNotes", e.target.value)}
          placeholder="Notes for the approver..." />
      </FieldRow>
      <FieldRow label="Approval conditions">
        <textarea className={textareaCls} rows={3} disabled={disabled} value={s.approvalConditions}
          onChange={(e) => set("approvalConditions", e.target.value)}
          placeholder="Conditions that must be met before issue..." />
      </FieldRow>
      <div className="grid grid-cols-3 gap-4">
        <FieldRow label="Next review date">
          <input type="date" className={inputCls} disabled={disabled} value={s.nextReviewDate}
            onChange={(e) => set("nextReviewDate", e.target.value)} />
        </FieldRow>
        <FieldRow label="Issue date">
          <input type="date" className={inputCls} disabled={disabled} value={s.issueDate}
            onChange={(e) => set("issueDate", e.target.value)} />
        </FieldRow>
        <FieldRow label="Expiry date">
          <input type="date" className={inputCls} disabled={disabled} value={s.expiryDate}
            onChange={(e) => set("expiryDate", e.target.value)} />
        </FieldRow>
      </div>
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export function MsEditor({
  ms: initialMs, projects, sites, canEdit, isAdmin,
}: {
  ms: MsData;
  projects: { id: string; name: string }[];
  sites: { id: string; name: string }[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SectionKey>("details");
  const [navOpen, setNavOpen] = useState(false);

  // Top-level mutable fields
  const [title, setTitle] = useState(initialMs.title);
  const [version] = useState(initialMs.version);
  const [projectId, setProjectId] = useState(initialMs.projectId);
  const [siteId, setSiteId] = useState(initialMs.siteId);
  const [status, setStatus] = useState(initialMs.status);

  // Sections
  const [sections, setSections] = useState<MsSections>(() => parseSections(initialMs.sectionsJson));

  // Save state
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  const isLocked = !!initialMs.lockedAt;
  const isEditable = canEdit && !isLocked;

  // Debounced autosave
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(JSON.stringify({ title, projectId, siteId, sections }));

  const doSave = useCallback(async (overrideStatus?: string) => {
    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch(`/api/orgs/${initialMs.orgId}/method-statements/${initialMs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          projectId,
          siteId,
          sectionsJson: sections,
          ...(overrideStatus && { status: overrideStatus }),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError((d as { message?: string }).message ?? "Save failed.");
        setSaveState("error");
        return false;
      }
      lastSaved.current = JSON.stringify({ title, projectId, siteId, sections });
      setSaveState("saved");
      if (overrideStatus) setStatus(overrideStatus);
      setTimeout(() => setSaveState("idle"), 2000);
      return true;
    } catch {
      setSaveError("Network error. Changes not saved.");
      setSaveState("error");
      return false;
    }
  }, [title, projectId, siteId, sections, initialMs.orgId, initialMs.id]);

  // Trigger autosave on change
  useEffect(() => {
    if (!isEditable) return;
    const current = JSON.stringify({ title, projectId, siteId, sections });
    if (current === lastSaved.current) return;
    if (pendingSave.current) clearTimeout(pendingSave.current);
    setSaveState("idle");
    pendingSave.current = setTimeout(() => doSave(), 1500);
    return () => { if (pendingSave.current) clearTimeout(pendingSave.current); };
  }, [title, projectId, siteId, sections, isEditable, doSave]);

  async function handleTransition(newStatus: string) {
    setTransitioning(true);
    // Save content first, then transition status
    const saved = isEditable ? await doSave() : true;
    if (!saved) { setTransitioning(false); return; }
    const res = await fetch(`/api/orgs/${initialMs.orgId}/method-statements/${initialMs.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError((d as { message?: string }).message ?? "Status change failed.");
    }
    setTransitioning(false);
  }

  async function handleRevise() {
    setTransitioning(true);
    const res = await fetch(`/api/orgs/${initialMs.orgId}/method-statements/${initialMs.id}/revise`, { method: "POST" });
    if (res.ok) {
      const data = await res.json() as { id: string };
      router.push(`/orgs/${initialMs.orgId}/method-statements/${data.id}`);
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError((d as { message?: string }).message ?? "Could not start revision.");
    }
    setTransitioning(false);
  }

  const sectionIdx = NAV_SECTIONS.findIndex((s) => s.key === activeSection);
  const canGoBack = sectionIdx > 0;
  const canGoNext = sectionIdx < NAV_SECTIONS.length - 1;

  const statusCfg = STATUS_LABELS[status] ?? STATUS_LABELS.draft!;

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* Navigator */}
      <aside className={`${navOpen ? "flex" : "hidden md:flex"} flex-col w-48 border-r border-gray-100 bg-white flex-shrink-0`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sections</span>
          <button className="md:hidden" onClick={() => setNavOpen(false)}>
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_SECTIONS.map((s) => (
            <button key={s.key}
              onClick={() => { setActiveSection(s.key); setNavOpen(false); }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${activeSection === s.key ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
              {s.label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          v{version}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0">
          <button className="md:hidden h-8 w-8 rounded flex items-center justify-center hover:bg-gray-100" onClick={() => setNavOpen(true)}>
            <Menu className="h-4 w-4 text-gray-500" />
          </button>
          <button onClick={() => router.push(`/orgs/${initialMs.orgId}/method-statements`)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ChevronLeft className="h-3.5 w-3.5" /> Method Statements
          </button>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-800 truncate max-w-[240px]">{title}</span>
          <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.cls}`}>{statusCfg.label}</span>
          <div className="ml-auto flex items-center gap-2">
            {/* Save status */}
            {saveState === "saving" && <span className="text-xs text-gray-400 flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> Saving...</span>}
            {saveState === "saved" && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</span>}
            {saveState === "error" && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {saveError}</span>}
            {isEditable && saveState === "idle" && (
              <button onClick={() => doSave()} className="h-7 px-3 rounded text-xs font-medium border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
                <Save className="h-3 w-3" /> Save
              </button>
            )}
            <button onClick={() => window.print()} className="h-7 w-7 rounded border border-gray-200 hover:bg-gray-50 flex items-center justify-center" title="Print">
              <Printer className="h-3.5 w-3.5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Locked banner */}
        {isLocked && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            This revision is locked. To make changes, start a new revision.
            {isAdmin && canEdit && (
              <button onClick={handleRevise} disabled={transitioning}
                className="ml-2 rounded border border-amber-300 bg-white px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                Start new revision
              </button>
            )}
          </div>
        )}

        {/* Section content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {NAV_SECTIONS.find((s) => s.key === activeSection)?.label}
            </h2>

            {activeSection === "details" && (
              <DetailsSection
                s={sections.details}
                ms={{ title, version, projectId, siteId }}
                projects={projects}
                sites={sites}
                onChange={(next) => setSections((s) => ({ ...s, details: next }))}
                onTopChange={(patch) => {
                  if (patch.title !== undefined) setTitle(patch.title);
                  if (patch.projectId !== undefined) setProjectId(patch.projectId);
                  if (patch.siteId !== undefined) setSiteId(patch.siteId);
                }}
                disabled={!isEditable}
              />
            )}
            {activeSection === "scope" && (
              <ScopeSection s={sections.scope} onChange={(next) => setSections((s) => ({ ...s, scope: next }))} disabled={!isEditable} />
            )}
            {activeSection === "resources" && (
              <ResourcesSection s={sections.resources} onChange={(next) => setSections((s) => ({ ...s, resources: next }))} disabled={!isEditable} />
            )}
            {activeSection === "riskControls" && (
              <RiskControlsSection s={sections.riskControls} onChange={(next) => setSections((s) => ({ ...s, riskControls: next }))} disabled={!isEditable} />
            )}
            {activeSection === "sequence" && (
              <SequenceSection s={sections.sequence} onChange={(next) => setSections((s) => ({ ...s, sequence: next }))} disabled={!isEditable} />
            )}
            {activeSection === "envEmergency" && (
              <EnvEmergencySection s={sections.envEmergency} onChange={(next) => setSections((s) => ({ ...s, envEmergency: next }))} disabled={!isEditable} />
            )}
            {activeSection === "review" && (
              <ReviewSection s={sections.review} onChange={(next) => setSections((s) => ({ ...s, review: next }))} disabled={!isEditable} />
            )}
          </div>
        </div>

        {/* Bottom bar: nav + status transitions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white flex-shrink-0">
          <button disabled={!canGoBack} onClick={() => setActiveSection(NAV_SECTIONS[sectionIdx - 1]!.key)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" /> Back
          </button>

          {/* Status action buttons */}
          <div className="flex items-center gap-2">
            {canEdit && status === "draft" && (
              <button onClick={() => handleTransition("review")} disabled={transitioning}
                className="rounded bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">
                Submit for review
              </button>
            )}
            {isAdmin && status === "review" && (
              <>
                <button onClick={() => handleTransition("draft")} disabled={transitioning}
                  className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Return to draft
                </button>
                <button onClick={() => handleTransition("approved")} disabled={transitioning}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  Approve
                </button>
              </>
            )}
            {isAdmin && status === "approved" && (
              <button onClick={() => handleTransition("issued")} disabled={transitioning}
                className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
                Issue
              </button>
            )}
            {isAdmin && canEdit && ["approved", "issued"].includes(status) && (
              <button onClick={handleRevise} disabled={transitioning}
                className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                New revision
              </button>
            )}
          </div>

          <button disabled={!canGoNext} onClick={() => setActiveSection(NAV_SECTIONS[sectionIdx + 1]!.key)}
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed">
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
