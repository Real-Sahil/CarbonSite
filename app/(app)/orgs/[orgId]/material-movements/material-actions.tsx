"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormActions, FormError, FormField, FormSection, fieldClass } from "@/components/forms/form-kit";

const input = fieldClass;
const kinds: [string, string][] = [
  ["contaminated_soil", "Contaminated soil"], ["asbestos", "Asbestos"], ["invasive_species", "Invasive species (e.g. Japanese knotweed)"],
  ["other_hazardous", "Other hazardous material"], ["biological", "Biological or clinical"], ["other", "Other controlled material"],
];
const routes: [string, string][] = [
  ["hazardous_landfill", "Hazardous landfill"], ["landfill_mixed", "Landfill"], ["recycling_mixed", "Recycling, treatment or reuse"],
  ["incineration_efw", "Incineration with energy recovery"],
];

type Option = { id: string; name: string };
type Json = Record<string, unknown>;
const day = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : v instanceof Date ? v.toISOString().slice(0, 10) : "");
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const nul = (s: string) => (s.trim() ? s.trim() : null);

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data;
}

function useRun(done?: () => void) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, okText = "Saved") {
    setBusy(true); setError(null); setOk(null);
    try { const r = await fn(); setOk(okText); done?.(); router.refresh(); return r; }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  return { busy, error, ok, run };
}

/** Uploads files as organisation evidence and keeps their ids. */
function FilePicker({ orgId, ids, setIds, label }: { orgId: string; ids: string[]; setIds: (v: string[]) => void; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/orgs/${orgId}/material/files`, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Upload failed");
      setIds([...ids, data.evidenceId]);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  return (
    <FormField label={label} htmlFor={`f-${label}`} span={2} hint={ids.length ? `${ids.length} file${ids.length > 1 ? "s" : ""} attached` : "PDF or photo, up to 15 MB each"} optional>
      <input id={`f-${label}`} type="file" accept="application/pdf,image/*" disabled={busy} onChange={upload} className="text-sm" />
      {err && <span role="alert" className="text-xs text-red-600">{err}</span>}
    </FormField>
  );
}

export function ClassificationForm({ orgId, sites, initial, onDone }: { orgId: string; sites: Option[]; initial?: Json & { id: string }; onDone?: () => void }) {
  const i = initial;
  const [f, setF] = useState({
    name: (i?.name as string) ?? "", materialKind: (i?.materialKind as string) ?? "contaminated_soil", description: (i?.description as string) ?? "",
    siteId: (i?.siteId as string) ?? "", ewcCode: (i?.ewcCode as string) ?? "", hazardous: (i?.hazardous as boolean) ?? false,
    hp: ((i?.hazardousProperties as string[]) ?? []).join(", "), labReference: (i?.labReference as string) ?? "", classifiedBy: (i?.classifiedBy as string) ?? "",
    classifiedOn: day(i?.classifiedOn), plannedRoute: (i?.plannedRoute as string) ?? "", estimatedTonnes: i?.estimatedTonnes != null ? String(i.estimatedTonnes) : "",
  });
  const [files, setFiles] = useState<string[]>((i?.evidenceFileIds as string[]) ?? []);
  const { busy, error, ok, run } = useRun(() => { if (!i) { setF({ ...f, name: "", description: "", ewcCode: "", hp: "", labReference: "", estimatedTonnes: "" }); setFiles([]); } onDone?.(); });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const body = () => ({
    name: f.name, materialKind: f.materialKind, description: nul(f.description), siteId: f.siteId || null, ewcCode: nul(f.ewcCode), hazardous: f.hazardous,
    hazardousProperties: list(f.hp), labReference: nul(f.labReference), classifiedBy: nul(f.classifiedBy), classifiedOn: f.classifiedOn || null,
    plannedRoute: f.plannedRoute || null, estimatedTonnes: f.estimatedTonnes || null, evidenceFileIds: files,
  });
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void run(() => (i ? send(`/api/orgs/${orgId}/material/classifications/${i.id}`, "PATCH", body()) : send(`/api/orgs/${orgId}/material/classifications`, "POST", body()))); }}>
      <FormSection title="The material" description="A stockpile or source area. Classify it before any load leaves." cols={2}>
        <FormField label="Name" htmlFor="mc-name" span={2}><input id="mc-name" required maxLength={200} className={input} value={f.name} onChange={set("name")} placeholder="e.g. Stockpile A, north corner" /></FormField>
        <FormField label="Kind" htmlFor="mc-kind"><select id="mc-kind" className={input} value={f.materialKind} onChange={set("materialKind")}>{kinds.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
        <FormField label="Site" htmlFor="mc-site" optional><select id="mc-site" className={input} value={f.siteId} onChange={set("siteId")}><option value="">Any site</option>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
        <FormField label="Description" htmlFor="mc-desc" span={2} optional><textarea id="mc-desc" rows={2} maxLength={2000} className={input} value={f.description} onChange={set("description")} /></FormField>
      </FormSection>
      <FormSection title="Classification" description="From the competent person's assessment, using the Environment Agency's waste classification guidance (WM3) and laboratory results." cols={2}>
        <FormField label="EWC code" htmlFor="mc-ewc" hint="Six digits, * for hazardous. E.g. 17 05 04 or 17 05 03*."><input id="mc-ewc" maxLength={20} className={input} value={f.ewcCode} onChange={set("ewcCode")} /></FormField>
        <FormField label="Hazardous" htmlFor="mc-haz"><label className="flex items-center gap-2 text-sm"><input id="mc-haz" type="checkbox" checked={f.hazardous} onChange={(e) => setF({ ...f, hazardous: e.target.checked })} /> This material is hazardous waste</label></FormField>
        <FormField label="Hazardous properties" htmlFor="mc-hp" optional hint="HP numbers, comma separated"><input id="mc-hp" className={input} value={f.hp} onChange={set("hp")} placeholder="HP5, HP14" /></FormField>
        <FormField label="Laboratory report reference" htmlFor="mc-lab" optional><input id="mc-lab" maxLength={300} className={input} value={f.labReference} onChange={set("labReference")} /></FormField>
        <FormField label="Classified by" htmlFor="mc-by" hint="The competent person"><input id="mc-by" maxLength={200} className={input} value={f.classifiedBy} onChange={set("classifiedBy")} /></FormField>
        <FormField label="Date classified" htmlFor="mc-on"><input id="mc-on" type="date" className={input} value={f.classifiedOn} onChange={set("classifiedOn")} /></FormField>
        <FormField label="Planned route" htmlFor="mc-route" optional><select id="mc-route" className={input} value={f.plannedRoute} onChange={set("plannedRoute")}><option value="">Not set</option>{routes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
        <FormField label="Estimated tonnes" htmlFor="mc-t" optional><input id="mc-t" type="number" min="0" step="any" className={input} value={f.estimatedTonnes} onChange={set("estimatedTonnes")} /></FormField>
        <FilePicker orgId={orgId} ids={files} setIds={setFiles} label="Laboratory report or assessment" />
      </FormSection>
      {error && <FormError>{error}</FormError>}
      {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
      <FormActions><Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : i ? "Save changes" : "Add classification"}</Button></FormActions>
    </form>
  );
}

export function ClassificationActions({ orgId, id, status, canApprove }: { orgId: string; id: string; status: string; canApprove: boolean }) {
  const { busy, error, run } = useRun();
  const act = (action: string) => run(() => send(`/api/orgs/${orgId}/material/classifications/${id}`, "PATCH", { action }), "Saved");
  return (
    <span className="flex flex-wrap items-center justify-end gap-3">
      {status !== "approved" && status !== "withdrawn" && <button type="button" disabled={busy || !canApprove} title={canApprove ? undefined : "Complete the details first"} onClick={() => void act("approve")} className="text-xs font-medium text-[#111827] underline underline-offset-2 disabled:no-underline disabled:opacity-40">Approve</button>}
      {status !== "withdrawn" && <button type="button" disabled={busy} onClick={() => void act("withdraw")} className="text-xs text-[#374151] underline underline-offset-2">Withdraw</button>}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </span>
  );
}

export function MovementForm({
  orgId, sites, facilities, classifications, initial, onDone,
}: {
  orgId: string; sites: Option[]; facilities: Option[]; classifications: (Option & { siteId: string | null; status: string; plannedRoute: string | null })[];
  initial?: Json & { id: string }; onDone?: () => void;
}) {
  const i = initial;
  const usable = classifications.filter((c) => c.status !== "withdrawn");
  const [f, setF] = useState({
    siteId: (i?.siteId as string) ?? sites[0]?.id ?? "", classificationId: (i?.classificationId as string) ?? usable[0]?.id ?? "", plannedOn: day(i?.plannedOn) || new Date().toISOString().slice(0, 10),
    plannedTonnes: i?.plannedTonnes != null ? String(i.plannedTonnes) : "", facilityId: (i?.facilityId as string) ?? "", disposalRoute: (i?.disposalRoute as string) ?? "",
    destinationName: (i?.destinationName as string) ?? "", destinationPermit: (i?.destinationPermit as string) ?? "", authorised: ((i?.destinationAuthorisedEwc as string[]) ?? []).join(", "),
    carrierName: (i?.carrierName as string) ?? "", carrierRegistration: (i?.carrierRegistration as string) ?? "", carrierExpiry: day(i?.carrierRegistrationExpiry),
    vehicleRegistration: (i?.vehicleRegistration as string) ?? "", noteReference: (i?.noteReference as string) ?? "", haulDistanceKm: i?.haulDistanceKm != null ? String(i.haulDistanceKm) : "",
    returnedCopyDue: day(i?.returnedCopyDue), returnedCopyOn: day(i?.returnedCopyOn),
  });
  const [files, setFiles] = useState<string[]>((i?.evidenceFileIds as string[]) ?? []);
  const { busy, error, ok, run } = useRun(() => { if (!i) setF({ ...f, plannedTonnes: "", noteReference: "", vehicleRegistration: "" }); onDone?.(); });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const shared = () => ({
    facilityId: f.facilityId || null, disposalRoute: f.disposalRoute || null, plannedOn: f.plannedOn, plannedTonnes: f.plannedTonnes, destinationName: f.destinationName,
    destinationPermit: nul(f.destinationPermit), destinationAuthorisedEwc: list(f.authorised), carrierName: nul(f.carrierName), carrierRegistration: nul(f.carrierRegistration),
    carrierRegistrationExpiry: f.carrierExpiry || null, vehicleRegistration: nul(f.vehicleRegistration), noteReference: nul(f.noteReference),
    haulDistanceKm: f.haulDistanceKm || null, returnedCopyDue: f.returnedCopyDue || null, evidenceFileIds: files,
  });
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => (i
          ? send(`/api/orgs/${orgId}/material/movements/${i.id}`, "PATCH", { action: "update", ...shared(), returnedCopyOn: f.returnedCopyOn || null })
          : send(`/api/orgs/${orgId}/material/movements`, "POST", { siteId: f.siteId, classificationId: f.classificationId, ...shared() })));
      }}
    >
      <FormSection title="The load" cols={2}>
        {!i && (<>
          <FormField label="Site" htmlFor="mm-site"><select id="mm-site" required className={input} value={f.siteId} onChange={set("siteId")}>{sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
          <FormField label="Material" htmlFor="mm-cls"><select id="mm-cls" required className={input} value={f.classificationId} onChange={set("classificationId")}>{usable.filter((c) => !c.siteId || c.siteId === f.siteId).map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "approved" ? " (not approved)" : ""}</option>)}</select></FormField>
        </>)}
        <FormField label="Planned date" htmlFor="mm-on"><input id="mm-on" required type="date" className={input} value={f.plannedOn} onChange={set("plannedOn")} /></FormField>
        <FormField label="Planned tonnes" htmlFor="mm-t"><input id="mm-t" required type="number" min="0.001" step="any" className={input} value={f.plannedTonnes} onChange={set("plannedTonnes")} /></FormField>
        <FormField label="Booked to facility" htmlFor="mm-fac" optional hint="Needed when the load is received"><select id="mm-fac" className={input} value={f.facilityId} onChange={set("facilityId")}><option value="">Choose at receipt</option>{facilities.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
        <FormField label="Route" htmlFor="mm-route" optional><select id="mm-route" className={input} value={f.disposalRoute} onChange={set("disposalRoute")}><option value="">From the classification</option>{routes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></FormField>
      </FormSection>
      <FormSection title="Destination" description="The receiving site, and the codes its permit or exemption covers, as you have them from its permit." cols={2}>
        <FormField label="Receiving site" htmlFor="mm-dest" span={2}><input id="mm-dest" required maxLength={200} className={input} value={f.destinationName} onChange={set("destinationName")} /></FormField>
        <FormField label="Permit or exemption number" htmlFor="mm-permit" optional><input id="mm-permit" maxLength={100} className={input} value={f.destinationPermit} onChange={set("destinationPermit")} /></FormField>
        <FormField label="EWC codes it may take" htmlFor="mm-auth" optional hint="Comma separated"><input id="mm-auth" className={input} value={f.authorised} onChange={set("authorised")} placeholder="17 05 03*, 17 05 04" /></FormField>
      </FormSection>
      <FormSection title="Carrier and notes" cols={2}>
        <FormField label="Carrier" htmlFor="mm-carrier"><input id="mm-carrier" maxLength={200} className={input} value={f.carrierName} onChange={set("carrierName")} /></FormField>
        <FormField label="Carrier registration" htmlFor="mm-reg" hint="E.g. CBDU123456"><input id="mm-reg" maxLength={40} className={input} value={f.carrierRegistration} onChange={set("carrierRegistration")} /></FormField>
        <FormField label="Registration expires" htmlFor="mm-exp" optional><input id="mm-exp" type="date" className={input} value={f.carrierExpiry} onChange={set("carrierExpiry")} /></FormField>
        <FormField label="Vehicle registration" htmlFor="mm-veh" optional><input id="mm-veh" maxLength={20} className={input} value={f.vehicleRegistration} onChange={set("vehicleRegistration")} /></FormField>
        <FormField label="Transfer or consignment note" htmlFor="mm-note" hint="Hazardous loads need a consignment note"><input id="mm-note" maxLength={100} className={input} value={f.noteReference} onChange={set("noteReference")} /></FormField>
        <FormField label="Haul distance (km)" htmlFor="mm-km" optional><input id="mm-km" type="number" min="0" step="any" className={input} value={f.haulDistanceKm} onChange={set("haulDistanceKm")} /></FormField>
        <FormField label="Returned copy due" htmlFor="mm-due" optional hint="Your own deadline"><input id="mm-due" type="date" className={input} value={f.returnedCopyDue} onChange={set("returnedCopyDue")} /></FormField>
        {i && <FormField label="Returned copy received" htmlFor="mm-back" optional><input id="mm-back" type="date" className={input} value={f.returnedCopyOn} onChange={set("returnedCopyOn")} /></FormField>}
        <FilePicker orgId={orgId} ids={files} setIds={setFiles} label="Tickets, notes and photographs" />
      </FormSection>
      {error && <FormError>{error}</FormError>}
      {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
      <FormActions><Button type="submit" size="sm" disabled={busy || (!i && !f.classificationId)}>{busy ? "Saving…" : i ? "Save changes" : "Plan this load"}</Button></FormActions>
    </form>
  );
}

export function MovementActions({ orgId, id, status, facilities, plannedTonnes, defaultFacilityId }: { orgId: string; id: string; status: string; facilities: Option[]; plannedTonnes: number; defaultFacilityId: string | null }) {
  const [receiving, setReceiving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rx, setRx] = useState({ on: new Date().toISOString().slice(0, 10), tonnes: String(plannedTonnes), facilityId: defaultFacilityId ?? "", reason: "" });
  const { busy, error, run } = useRun(() => { setReceiving(false); setRejecting(false); });
  const patch = (body: unknown, okText: string) => run(() => send(`/api/orgs/${orgId}/material/movements/${id}`, "PATCH", body), okText);
  const link = "text-xs underline underline-offset-2 disabled:opacity-50";
  return (
    <div className="flex flex-col items-end gap-2">
      <span className="flex flex-wrap items-center justify-end gap-3">
        {status === "planned" && <button type="button" disabled={busy} className={link} onClick={() => void patch({ action: "dispatch" }, "Dispatched")}>Dispatch</button>}
        {(status === "planned" || status === "dispatched") && <button type="button" disabled={busy} className={link} onClick={() => { setReceiving(!receiving); setRejecting(false); }}>Record receipt</button>}
        {(status === "planned" || status === "dispatched") && <button type="button" disabled={busy} className={link} onClick={() => { setRejecting(!rejecting); setReceiving(false); }}>Reject</button>}
        {(status === "planned" || status === "dispatched") && <button type="button" disabled={busy} className={link} onClick={() => void patch({ action: "cancel" }, "Cancelled")}>Cancel</button>}
        {(status === "planned" || status === "cancelled") && (
          <button type="button" disabled={busy} className={`${link} text-red-600`} onClick={() => { if (window.confirm("Delete this load? The audit trail keeps a record.")) void run(() => send(`/api/orgs/${orgId}/material/movements/${id}`, "DELETE"), "Deleted"); }}>Delete</button>
        )}
      </span>
      {receiving && (
        <form className="flex flex-wrap items-end justify-end gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); void patch({ action: "receive", receivedOn: rx.on, ticketTonnes: rx.tonnes, facilityId: rx.facilityId || null }, "Received"); }}>
          <label>Date<input required type="date" className={`${input} !w-36`} value={rx.on} onChange={(e) => setRx({ ...rx, on: e.target.value })} /></label>
          <label>Ticket tonnes<input required type="number" min="0.001" step="any" className={`${input} !w-28`} value={rx.tonnes} onChange={(e) => setRx({ ...rx, tonnes: e.target.value })} /></label>
          <label>Facility<select required className={`${input} !w-44`} value={rx.facilityId} onChange={(e) => setRx({ ...rx, facilityId: e.target.value })}><option value="">Choose</option>{facilities.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <Button type="submit" size="sm" disabled={busy}>Receive</Button>
        </form>
      )}
      {rejecting && (
        <form className="flex flex-wrap items-end justify-end gap-2 text-xs" onSubmit={(e) => { e.preventDefault(); void patch({ action: "reject", rejectionReason: rx.reason }, "Rejected"); }}>
          <label>Why<input required maxLength={1000} className={`${input} !w-64`} value={rx.reason} onChange={(e) => setRx({ ...rx, reason: e.target.value })} /></label>
          <Button type="submit" size="sm" disabled={busy}>Reject load</Button>
        </form>
      )}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

function EditToggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="text-xs underline underline-offset-2" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Close" : label}</button>
      {open && <div className="mt-3 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-left">{children(() => setOpen(false))}</div>}
    </div>
  );
}

/** Opens the classification form in place, to edit a row. */
export function EditClassification({ orgId, sites, initial }: { orgId: string; sites: Option[]; initial: Json & { id: string } }) {
  return <EditToggle label="Edit">{(close) => <ClassificationForm orgId={orgId} sites={sites} initial={initial} onDone={close} />}</EditToggle>;
}

/** Opens the load form in place, to edit a row. */
export function EditMovement(props: { orgId: string; sites: Option[]; facilities: Option[]; classifications: (Option & { siteId: string | null; status: string; plannedRoute: string | null })[]; initial: Json & { id: string } }) {
  return <EditToggle label="Edit details">{(close) => <MovementForm {...props} onDone={close} />}</EditToggle>;
}
