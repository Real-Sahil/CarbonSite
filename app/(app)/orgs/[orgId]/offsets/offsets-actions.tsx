"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck, Loader2, X } from "lucide-react";
import { FormField, FormSection, fieldClass, FormActions, FormError } from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";

export const PROJECT_TYPES = [
  { value: "forestry",           label: "Forestry / REDD+" },
  { value: "renewable_energy",   label: "Renewable energy" },
  { value: "methane_capture",    label: "Methane capture" },
  { value: "blue_carbon",        label: "Blue carbon" },
  { value: "soil_carbon",        label: "Soil carbon" },
  { value: "direct_air_capture", label: "Direct air capture" },
  { value: "other",              label: "Other" },
];

export const STATUS_COLORS: Record<string, string> = {
  forestry:           "bg-green-100 text-green-700",
  renewable_energy:   "bg-[#fff7ed] text-[#c2410c]",
  methane_capture:    "bg-purple-100 text-purple-700",
  blue_carbon:        "bg-blue-100 text-blue-700",
  soil_carbon:        "bg-amber-100 text-amber-700",
  direct_air_capture: "bg-rose-100 text-rose-700",
  other:              "bg-gray-100 text-gray-600",
};

const STANDARDS = ["VCS", "Gold_Standard", "REDD+", "Plan_Vivo", "ACR", "CAR", "Other"];

function AddOffsetModal({ orgId, onClose, onSaved }: { orgId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    provider: "", projectName: "", projectType: "forestry",
    standard: "VCS", vintage: new Date().getFullYear() - 1,
    quantityTonnes: "", pricePerTonne: "", currency: "GBP",
    purchasedAt: new Date().toISOString().slice(0, 10),
    retirementRef: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string | number) { setForm((f) => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/offsets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          vintage: Number(form.vintage),
          quantityTonnes: Number(form.quantityTonnes),
          pricePerTonne: form.pricePerTonne ? Number(form.pricePerTonne) : undefined,
          purchasedAt: new Date(form.purchasedAt).toISOString(),
          retirementRef: form.retirementRef || undefined,
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { message?: string }).message ?? "Failed to save offset.");
        return;
      }
      onSaved();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = fieldClass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add carbon offset</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <FormSection title="The project" cols={2}>
            <FormField label="Project name" htmlFor="f-project-name" span={2}>
                <input id="f-project-name" type="text" required value={form.projectName} onChange={(e) => set("projectName", e.target.value)} className={inputCls} placeholder="Acre Amazon REDD+ Project" />
              </FormField>
              <FormField label="Provider / registry" htmlFor="f-provider-registry">
                <input id="f-provider-registry" type="text" required value={form.provider} onChange={(e) => set("provider", e.target.value)} className={inputCls} placeholder="South Pole, ClimateCare..." />
              </FormField>
              <FormField label="Standard" htmlFor="f-standard" optional>
                <select id="f-standard" value={form.standard} onChange={(e) => set("standard", e.target.value)} className={inputCls}>
                  {STANDARDS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </FormField>
              <FormField label="Project type" htmlFor="f-project-type">
                <select id="f-project-type" value={form.projectType} onChange={(e) => set("projectType", e.target.value)} className={inputCls}>
                  {PROJECT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </FormField>
          </FormSection>
            <FormSection title="The purchase" cols={2}>
              <FormField label="Vintage year" htmlFor="f-vintage-year">
                <input id="f-vintage-year" type="number" required min={2000} max={2050} value={form.vintage} onChange={(e) => set("vintage", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Quantity (tCO₂e)" htmlFor="f-quantity-tco-e">
                <input id="f-quantity-tco-e" type="number" required min="0.0001" step="0.0001" value={form.quantityTonnes} onChange={(e) => set("quantityTonnes", e.target.value)} className={inputCls} placeholder="100.0000" />
              </FormField>
              <FormField label="Price / tonne" htmlFor="f-price-tonne" optional>
                <input id="f-price-tonne" type="number" min="0" step="0.01" value={form.pricePerTonne} onChange={(e) => set("pricePerTonne", e.target.value)} className={inputCls} placeholder="15.00" />
              </FormField>
              <FormField label="Currency" htmlFor="f-currency">
                <input id="f-currency" type="text" maxLength={3} value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} className={inputCls} />
              </FormField>
              <FormField label="Purchase date" htmlFor="f-purchase-date">
                <input id="f-purchase-date" type="date" required value={form.purchasedAt} onChange={(e) => set("purchasedAt", e.target.value)} className={inputCls} />
              </FormField>
              <FormField label="Retirement ref" htmlFor="f-retirement-ref" span={2} optional>
                <input id="f-retirement-ref" type="text" value={form.retirementRef} onChange={(e) => set("retirementRef", e.target.value)} className={inputCls} placeholder="Gold Standard retirement certificate #..." />
              </FormField>
              <FormField label="Notes" span={4} htmlFor="f-notes" optional>
                <textarea id="f-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputCls} resize-none`} />
              </FormField>
            </FormSection>
          <FormError>{error}</FormError>
          <FormActions>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>{loading ? "Saving..." : "Save offset"}</Button>
          </FormActions>
        </form>
      </div>
    </div>
  );
}

export function AddOffsetButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <>
      <button onClick={() => setShowAdd(true)}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[#c2410c] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9a3412] transition-colors">
        <Plus className="h-4 w-4" />
        Add offset
      </button>
      {showAdd && (
        <AddOffsetModal
          orgId={orgId}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
    </>
  );
}

export function OffsetRowActions({ orgId, id, retirementRef, retirementVerified }: {
  orgId: string;
  id: string;
  retirementRef: string | null;
  retirementVerified: boolean;
}) {
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    if (!retirementRef) {
      alert("Add a retirement reference before verifying.");
      return;
    }
    setVerifying(true);
    try {
      await fetch(`/api/orgs/${orgId}/offsets/${id}/verify-retirement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: retirementRef }),
      });
      router.refresh();
    } catch {
      window.alert("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this offset record?")) return;
    await fetch(`/api/orgs/${orgId}/offsets/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {!retirementVerified && (
        <button onClick={handleVerify} disabled={verifying} title="Verify via OffsetsDB"
          className="h-7 w-7 rounded-lg hover:bg-green-50 flex items-center justify-center group disabled:opacity-50">
          {verifying
            ? <Loader2 className="h-3.5 w-3.5 text-gray-500 animate-spin" />
            : <ShieldCheck className="h-3.5 w-3.5 text-gray-300 group-hover:text-green-600 transition-colors" />
          }
        </button>
      )}
      <button onClick={handleDelete} className="h-7 w-7 rounded-lg hover:bg-red-50 flex items-center justify-center group">
        <Trash2 className="h-3.5 w-3.5 text-gray-300 group-hover:text-red-500 transition-colors" />
      </button>
    </div>
  );
}
