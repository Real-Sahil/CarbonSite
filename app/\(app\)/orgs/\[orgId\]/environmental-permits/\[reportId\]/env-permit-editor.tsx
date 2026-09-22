"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, CheckCircle2 } from "lucide-react";

export interface EnvPermitData {
  id: string; orgId: string; title: string; version: string; status: string; projectId: string | null; siteId: string | null;
  sectionsJson: unknown; permitDate: string | null; expiryDate: string | null; lockedAt: string | null; revisionOf: string | null;
  createdAt: string; updatedAt: string; createdBy: { id: string; name: string | null } | null;
  signedOffBy: { id: string; name: string | null } | null; project: { id: string; name: string } | null; site: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", review: "Under Review", approved: "Approved", issued: "Issued", signed_off: "Signed Off", superseded: "Superseded",
};

export function EnvironmentalPermitEditor({
  report, projects, sites, canEdit, isAdmin,
}: {
  report: EnvPermitData; projects: any[]; sites: any[]; canEdit: boolean; isAdmin: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(report.title);
  const [projectId, setProjectId] = useState(report.projectId || "");
  const [siteId, setSiteId] = useState(report.siteId || "");
  const [permitDate, setPermitDate] = useState(report.permitDate || "");
  const [expiryDate, setExpiryDate] = useState(report.expiryDate || "");
  const [status, setStatus] = useState(report.status);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const disabled = !canEdit || !!report.lockedAt;

  const autoSave = useCallback(() => {
    if (!canEdit || saveStatus === "saving") return;
    setSaveStatus("saving");
    fetch(`/api/orgs/${report.orgId}/environmental-permits/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, projectId, siteId, permitDate, expiryDate }),
    })
      .then(() => { setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); })
      .catch(() => setSaveStatus("idle"));
  }, [title, projectId, siteId, permitDate, expiryDate, canEdit, report.orgId, report.id, saveStatus]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(autoSave, 1500);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [title, projectId, siteId, permitDate, expiryDate, autoSave]);

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/environmental-permits/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) setStatus(newStatus);
    } catch (err) { console.error(err); }
  };

  const handleRevise = async () => {
    try {
      const res = await fetch(`/api/orgs/${report.orgId}/environmental-permits/${report.id}/revise`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        router.push(`/orgs/${report.orgId}/environmental-permits/${data.id}`);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="flex items-center space-x-2">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${status === "draft" ? "bg-gray-100 text-gray-700" : status === "review" ? "bg-amber-100 text-amber-800" : status === "approved" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                {STATUS_LABELS[status] || status}
              </span>
              {saveStatus === "saved" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>
          </div>
          <div className="space-y-4">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={disabled} className="w-full px-3 py-2 border rounded" placeholder="Title" />
            <div className="grid grid-cols-2 gap-4">
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={disabled} className="px-3 py-2 border rounded">
                <option value="">Project</option>
                {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={disabled} className="px-3 py-2 border rounded">
                <option value="">Site</option>
                {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={permitDate} onChange={(e) => setPermitDate(e.target.value)} disabled={disabled} className="px-3 py-2 border rounded" placeholder="Permit Date" />
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={disabled} className="px-3 py-2 border rounded" placeholder="Expiry Date" />
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <p className="text-sm font-medium">Actions</p>
            <div className="flex flex-wrap gap-2">
              {status === "draft" && <button onClick={() => handleStatusChange("review")} className="px-4 py-2 bg-amber-600 text-white rounded text-sm">Submit for Review</button>}
              {status === "review" && isAdmin && (
                <>
                  <button onClick={() => handleStatusChange("approved")} className="px-4 py-2 bg-green-600 text-white rounded text-sm">Approve</button>
                  <button onClick={() => handleStatusChange("draft")} className="px-4 py-2 bg-gray-600 text-white rounded text-sm">Reject</button>
                </>
              )}
              {status === "approved" && isAdmin && <button onClick={() => handleStatusChange("issued")} className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Issue</button>}
              {(status === "approved" || status === "issued") && !report.lockedAt && <button onClick={handleRevise} className="px-4 py-2 bg-purple-600 text-white rounded text-sm">Create Revision</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
