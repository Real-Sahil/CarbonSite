"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

const input = fieldClass;
const today = () => new Date().toISOString().slice(0, 10);

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data;
}

function useSubmit(done: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, okText: string) {
    setBusy(true); setError(null); setOk(null);
    try { await fn(); setOk(okText); done(); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  return { busy, error, ok, run };
}

type Option = { id: string; name: string };

export function AddStoreForm({ orgId, sites }: { orgId: string; sites: Option[] }) {
  const empty = { name: "", kind: "bowser", fuelType: "diesel", capacityLitres: "", ownership: "owned", identifier: "", siteId: "", bunded: "" };
  const [f, setF] = useState(empty);
  const { busy, error, ok, run } = useSubmit(() => setF(empty));
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => send(`/api/orgs/${orgId}/fuel/stores`, "POST", { ...f, siteId: f.siteId || null, bunded: f.bunded === "" ? null : f.bunded === "yes" }), "Fuel store added");
      }}
    >
      <FormSection title="The store" description="A bowser, a fixed tank or an IBC that holds fuel on site." cols={2}>
        <FormField label="Name" htmlFor="fs-name" span={2}><input id="fs-name" required maxLength={200} className={input} value={f.name} onChange={set("name")} placeholder="e.g. Bowser 1, 2,000 L" /></FormField>
        <FormField label="Kind" htmlFor="fs-kind">
          <select id="fs-kind" className={input} value={f.kind} onChange={set("kind")}>
            <option value="bowser">Bowser</option><option value="fixed_tank">Fixed tank</option><option value="ibc">IBC</option>
          </select>
        </FormField>
        <FormField label="Capacity (litres)" htmlFor="fs-cap"><input id="fs-cap" required type="number" min="1" step="any" className={input} value={f.capacityLitres} onChange={set("capacityLitres")} /></FormField>
        <FormField label="Usual fuel" htmlFor="fs-fuel">
          <input id="fs-fuel" list="fs-fuels" required maxLength={40} className={input} value={f.fuelType} onChange={set("fuelType")} />
          <datalist id="fs-fuels"><option value="diesel" /><option value="HVO" /><option value="HVO50" /><option value="petrol" /></datalist>
        </FormField>
        <FormField label="Serial number or registration" htmlFor="fs-id"><input id="fs-id" maxLength={100} className={input} value={f.identifier} onChange={set("identifier")} /></FormField>
      </FormSection>
      <FormSection title="Ownership and site" cols={2}>
        <FormField label="Owned or hired" htmlFor="fs-own">
          <select id="fs-own" className={input} value={f.ownership} onChange={set("ownership")}><option value="owned">Owned</option><option value="hired">Hired</option></select>
        </FormField>
        <FormField label="Site" htmlFor="fs-site">
          <select id="fs-site" className={input} value={f.siteId} onChange={set("siteId")}>
            <option value="">No site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Bunded" htmlFor="fs-bund" optional>
          <select id="fs-bund" className={input} value={f.bunded} onChange={set("bunded")}><option value="">Not stated</option><option value="yes">Yes</option><option value="no">No</option></select>
        </FormField>
      </FormSection>
      {error && <FormError>{error}</FormError>}
      {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
      <FormActions><Button type="submit" size="sm" disabled={busy}>{busy ? "Adding…" : "Add fuel store"}</Button></FormActions>
    </form>
  );
}

export function AddEntryForm({ orgId, stores, machines }: { orgId: string; stores: Option[]; machines: Option[] }) {
  const empty = { kind: "delivery", storeId: stores[0]?.id ?? "", on: today(), litres: "", fuelType: "diesel", supplierName: "", reference: "", plantAssetId: "", vehicleLabel: "", meterReading: "" };
  const [f, setF] = useState(empty);
  const { busy, error, ok, run } = useSubmit(() => setF({ ...empty, kind: f.kind, storeId: f.storeId, on: f.on }));
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const payload = () => ({
    kind: f.kind, storeId: f.storeId, on: f.on, litres: f.litres,
    ...(f.kind === "delivery" ? { fuelType: f.fuelType, supplierName: f.supplierName || null, reference: f.reference || null } : {}),
    ...(f.kind === "issue" ? { plantAssetId: f.plantAssetId || null, vehicleLabel: f.vehicleLabel || null, meterReading: f.meterReading || null } : {}),
  });
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void run(() => send(`/api/orgs/${orgId}/fuel/entries`, "POST", payload()), "Saved"); }}>
      <FormSection title="What happened" description="A dip is the level you measured at the end of the day, after that day's fuel in and out." cols={2}>
        <FormField label="Entry" htmlFor="fe-kind">
          <select id="fe-kind" className={input} value={f.kind} onChange={set("kind")}>
            <option value="delivery">Delivery into the store</option><option value="issue">Issue to a machine</option><option value="dip">Dip (level measured)</option>
          </select>
        </FormField>
        <FormField label="Store" htmlFor="fe-store">
          <select id="fe-store" required className={input} value={f.storeId} onChange={set("storeId")}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </FormField>
        <FormField label="Date" htmlFor="fe-on"><input id="fe-on" required type="date" className={input} value={f.on} onChange={set("on")} /></FormField>
        <FormField label={f.kind === "dip" ? "Level (litres)" : "Litres"} htmlFor="fe-l"><input id="fe-l" required type="number" min={f.kind === "dip" ? 0 : 0.01} step="any" className={input} value={f.litres} onChange={set("litres")} /></FormField>
        {f.kind === "delivery" && (<>
          <FormField label="Fuel type" htmlFor="fe-fuel"><input id="fe-fuel" list="fs-fuels" required maxLength={40} className={input} value={f.fuelType} onChange={set("fuelType")} /></FormField>
          <FormField label="Supplier" htmlFor="fe-sup" optional><input id="fe-sup" maxLength={200} className={input} value={f.supplierName} onChange={set("supplierName")} /></FormField>
          <FormField label="Delivery note reference" htmlFor="fe-ref" optional><input id="fe-ref" maxLength={100} className={input} value={f.reference} onChange={set("reference")} /></FormField>
        </>)}
        {f.kind === "issue" && (<>
          <FormField label="Machine" htmlFor="fe-asset">
            <select id="fe-asset" className={input} value={f.plantAssetId} onChange={set("plantAssetId")}>
              <option value="">Not in the register</option>{machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </FormField>
          <FormField label="Or vehicle name" htmlFor="fe-veh" hint="Needed when the machine is not in the register."><input id="fe-veh" maxLength={120} className={input} value={f.vehicleLabel} onChange={set("vehicleLabel")} placeholder="e.g. Hired van, AB12 CDE" /></FormField>
          <FormField label="Hours or meter reading" htmlFor="fe-meter" optional><input id="fe-meter" type="number" min="0" step="any" className={input} value={f.meterReading} onChange={set("meterReading")} /></FormField>
        </>)}
      </FormSection>
      {error && <FormError>{error}</FormError>}
      {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
      <FormActions><Button type="submit" size="sm" disabled={busy || !f.storeId}>{busy ? "Saving…" : "Save entry"}</Button></FormActions>
    </form>
  );
}

export function DeleteEntryButton({ orgId, kind, id }: { orgId: string; kind: string; id: string }) {
  const { busy, error, run } = useSubmit(() => {});
  return (
    <>
      <button
        type="button" disabled={busy} className="text-xs text-red-600 underline underline-offset-2 disabled:opacity-50"
        onClick={() => { if (window.confirm("Remove this entry? The audit trail keeps a record of it.")) void run(() => send(`/api/orgs/${orgId}/fuel/entries?kind=${kind}&id=${id}`, "DELETE"), "Removed"); }}
      >
        Remove
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}

export function RetireStoreButton({ orgId, storeId, active }: { orgId: string; storeId: string; active: boolean }) {
  const { busy, error, run } = useSubmit(() => {});
  return (
    <>
      <button type="button" disabled={busy} className="text-xs text-[#374151] underline underline-offset-2 disabled:opacity-50" onClick={() => void run(() => send(`/api/orgs/${orgId}/fuel/stores/${storeId}`, "PATCH", { active: !active }), "Saved")}>
        {active ? "Retire" : "Reactivate"}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}
