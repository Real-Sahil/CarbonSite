"use client";

import { useState } from "react";
import { RegisterResultCard } from "./register-result";
import { useRouter } from "next/navigation";
import { FormActions, FormError, FormField, FormSection } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DOC_KINDS } from "@/lib/waste/documents";
import { CompanyFinder } from "@/components/company/company-finder";
import { AcceptAsRecord } from "./accept-record";

export function AddDocument({ orgId, projects, defaultProjectId }: { orgId: string; projects: { id: string; name: string }[]; defaultProjectId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents`, { method: "POST", body: new FormData(e.currentTarget) }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setOpen(false);
      router.refresh();
    } else setError(d?.message ?? "Could not add the document.");
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Add document</Button>;
  return (
    <form onSubmit={submit} className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5">
      <FormSection title="Add a document" cols={2}>
        <FormField label="Kind" htmlFor="wd-kind">
          <select id="wd-kind" name="kind" required defaultValue="" className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <option value="" disabled>Choose</option>
            {DOC_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </FormField>
        <FormField label="Title" htmlFor="wd-title" optional hint="Defaults to the file name."><Input id="wd-title" name="title" maxLength={160} /></FormField>
        <FormField label="Reference" htmlFor="wd-ref" optional><Input id="wd-ref" name="reference" maxLength={120} /></FormField>
        <FormField label="Carrier or site it covers" htmlFor="wd-issuer" optional><Input id="wd-issuer" name="issuer" maxLength={160} /><CompanyFinder base={`/api/orgs/${orgId}/companies`} getName={() => (document.getElementById("wd-issuer") as HTMLInputElement | null)?.value ?? ""} label="Find company" onPick={(p) => { const el = document.getElementById("wd-issuer") as HTMLInputElement | null; if (el) el.value = p.company.name; }} /></FormField>
        <FormField label="Valid until" htmlFor="wd-valid" optional hint="For licences, permits and exemptions."><Input id="wd-valid" name="validUntil" type="date" /></FormField>
        <FormField label="Project" htmlFor="wd-project" optional>
          <select id="wd-project" name="projectId" defaultValue={defaultProjectId ?? ""} className="h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm">
            <option value="">Not tied to a project</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </FormField>
        <FormField label="File (PDF or photo, 10 MB)" htmlFor="wd-file" span={2}><Input id="wd-file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" /></FormField>
      </FormSection>
      <div className="mt-4 space-y-3">
        <FormError>{error}</FormError>
        <FormActions start={<Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
        </FormActions>
      </div>
    </form>
  );
}

// Public search pages only: those registers have no open API or licence we can use, so a person checks by hand.
const OTHER_REGISTERS: [string, string][] = [
  ["Scotland (SEPA)", "https://search-the-register.sepa.org.uk/Find-Waste-Transporters-Brokers"],
  ["Wales (NRW)", "https://naturalresources.wales/permits-and-permissions/waste-carriers-brokers-and-dealers-public-register/?lang=en"],
  ["Northern Ireland (DAERA)", "https://public-registers.daera-ni.gov.uk"],
];

type RegisterCheck =
  | { status: "not_checked"; reason: string }
  | { status: "not_found"; registration: string; checkedAt: string }
  | { status: "unavailable"; registration: string; checkedAt: string }
  | { status: "registered" | "expired"; registration: string; holder: string | null; tier: string | null; expiryDate: string | null; checkedAt: string; company?: { number: string; status: string | null; flags: { level: "red" | "amber"; text: string }[] } };
type PermitCheck =
  | { status: "not_checked"; reason: string }
  | { status: "not_found"; reference: string; checkedAt: string }
  | { status: "unavailable"; reference: string; checkedAt: string }
  | { status: "effective" | "not_effective"; reference: string; holder: string | null; site: string | null; siteType: string | null; registerStatus: string | null; codes: string[]; expiryDate: string | null; checkedAt: string };
const EA = "Contains Environment Agency information © Environment Agency and/or database right. England only; not an Agency endorsement.";
const HAND_CHECK = <>Check it by hand on the regulator&apos;s own register: {OTHER_REGISTERS.map(([name, href], i) => (
  <span key={name}>{i > 0 && ", "}<a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 underline underline-offset-2">{name}</a></span>
))}.</>;

function CarrierResult({ check }: { check: RegisterCheck }) {
  if (check.status === "not_checked") return <RegisterResultCard tone="idle" title="Not checked" attribution={EA}><p>{check.reason} {HAND_CHECK}</p></RegisterResultCard>;
  if (check.status === "unavailable") return <RegisterResultCard tone="warn" title="Register did not answer" subtitle={check.registration} attribution={EA}><p>That does not mean the carrier is not registered. Try again.</p></RegisterResultCard>;
  if (check.status === "not_found") {
    return (
      <RegisterResultCard tone="warn" title="Not on the England register" subtitle={check.registration} attribution={EA}>
        <p>Check the number, or the carrier may have lapsed. Welsh registrations use the same CBDU and CBDL numbers, so also check <a href={OTHER_REGISTERS[1][1]} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-700 underline underline-offset-2">Natural Resources Wales</a>.</p>
      </RegisterResultCard>
    );
  }
  const inDate = check.status === "registered";
  const co = check.company;
  const coBad = !!co && (co.status ?? "").toLowerCase() !== "active";
  return (
    <RegisterResultCard
      tone={!inDate || coBad ? "bad" : "ok"}
      title={inDate ? "On the register" : "Registration expired"}
      subtitle={check.registration}
      facts={[
        { label: "Holder", value: check.holder ?? "Not shown" },
        ...(check.tier ? [{ label: "Tier", value: check.tier }] : []),
        ...(check.expiryDate ? [{ label: "Expires", value: check.expiryDate }] : []),
        ...(co ? [{ label: "Companies House", value: <span className={coBad ? "text-red-700" : undefined}>{co.number}, {(co.status ?? "status not shown").replace(/-/g, " ")}</span> }] : []),
        { label: "Checked", value: check.checkedAt.slice(0, 10) },
      ]}
      attribution={EA}
    >
      <p>Compare the holder with the carrier named on the document.{co && co.flags.length > 0 && ` ${co.flags.map((f) => f.text).join("; ")}.`}</p>
    </RegisterResultCard>
  );
}

function PermitResult({ permit }: { permit: PermitCheck }) {
  if (permit.status === "not_checked") return <RegisterResultCard tone="idle" title="Not checked" attribution={EA}><p>{permit.reason} Check it by hand on the regulator&apos;s own register.</p></RegisterResultCard>;
  if (permit.status === "unavailable") return <RegisterResultCard tone="warn" title="Register did not answer" subtitle={permit.reference} attribution={EA}><p>That does not mean there is no permit. Try again.</p></RegisterResultCard>;
  if (permit.status === "not_found") return <RegisterResultCard tone="warn" title="Not on the England register" subtitle={permit.reference} attribution={EA}><p>Check the number, or the permit may be held elsewhere or have lapsed.</p></RegisterResultCard>;
  return (
    <RegisterResultCard
      tone={permit.status === "effective" ? "ok" : "bad"}
      title={permit.status === "effective" ? "In force" : "Not in force"}
      subtitle={permit.reference}
      facts={[
        { label: "Holder", value: permit.holder ?? "Not shown" },
        ...(permit.site ? [{ label: "Site", value: permit.site }] : []),
        ...(permit.siteType ? [{ label: "Type", value: permit.siteType }] : []),
        ...(permit.registerStatus ? [{ label: "Register status", value: permit.registerStatus }] : []),
        ...(permit.codes.length > 0 ? [{ label: "Exemptions", value: permit.codes.join(", ") }] : []),
        ...(permit.expiryDate ? [{ label: "Expires", value: permit.expiryDate }] : []),
        { label: "Checked", value: permit.checkedAt.slice(0, 10) },
      ]}
      attribution={EA}
    >
      <p>The register does not list which waste codes this covers: check the site may take this waste.</p>
    </RegisterResultCard>
  );
}

type Found = { registerCheck?: RegisterCheck; permitCheck?: PermitCheck; reference?: string; carrier?: string; carrierRegistration?: string; permit?: string; ewc?: string; tonnes?: number; date?: string; vehicle?: string; expiry?: string; found: number };
const LABELS: [keyof Found, string][] = [["reference", "Reference"], ["carrier", "Carrier"], ["carrierRegistration", "Carrier licence"], ["permit", "Permit"], ["ewc", "EWC code"], ["tonnes", "Tonnes"], ["date", "Date"], ["vehicle", "Vehicle"], ["expiry", "Expires"]];

export function DocumentActions({ orgId, id, kind, status, extracted, recorded, prefill, facilities, periods }: { orgId: string; id: string; kind: string; status: string; extracted: Found | null; recorded: boolean; prefill: React.ComponentProps<typeof AcceptAsRecord>["prefill"]; facilities: { id: string; name: string }[]; periods: { id: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Found | null>(extracted);
  const [note, setNote] = useState<string | null>(null);
  async function read() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${id}/read`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) { setFound(d.reading); if (d.reading.registerCheck) setCheck(d.reading.registerCheck); }
    else setNote(d?.message ?? "Could not read that file.");
  }
  const [check, setCheck] = useState<RegisterCheck | null>(extracted?.registerCheck ?? null);
  async function checkRegister() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${id}/check-carrier`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) setCheck(d.result);
    else setNote(d?.message ?? "Could not check the register.");
  }
  const [permit, setPermit] = useState<PermitCheck | null>(extracted?.permitCheck ?? null);
  async function checkPermit() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${id}/check-permit`, { method: "POST" }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) setPermit(d.result);
    else setNote(d?.message ?? "Could not check the register.");
  }
  async function apply() {
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply: true }) });
    const d = await res.json().catch(() => null);
    setNote(Object.keys(d?.applied ?? {}).length ? "Filled the empty fields." : "Nothing to fill: those fields already have values.");
    router.refresh();
  }
  async function call(method: "PATCH" | "DELETE", body?: unknown) {
    await fetch(`/api/orgs/${orgId}/waste/documents/${id}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    router.refresh();
  }
  return (
    <div className="space-y-1 text-xs">
    <div className="flex gap-3">
      <button type="button" disabled={busy} className="text-gray-700 underline underline-offset-2" onClick={() => void read()}>{busy ? "Reading…" : found ? "Read again" : "Read file"}</button>
      {(kind === "carrier_licence" || kind === "transfer_note") && <button type="button" disabled={busy} className="text-gray-700 underline underline-offset-2" onClick={() => void checkRegister()}>Check carrier register</button>}
      {(kind === "site_permit" || kind === "exemption") && <button type="button" disabled={busy} className="text-gray-700 underline underline-offset-2" onClick={() => void checkPermit()}>Check permit register</button>}
      {kind === "transfer_note" && !recorded && facilities.length > 0 && periods.length > 0 && <AcceptAsRecord orgId={orgId} docId={id} prefill={{ ...prefill, carrierRegistration: extracted?.carrierRegistration, ewc: extracted?.ewc, tonnes: extracted?.tonnes, date: extracted?.date, vehicle: extracted?.vehicle }} facilities={facilities} periods={periods} />}
      {kind === "transfer_note" && recorded && <span className="text-green-700">Recorded as waste</span>}
      {status === "pending" && (
        <>
          <button type="button" className="font-medium text-teal-700 underline underline-offset-2" onClick={() => void call("PATCH", { status: "accepted" })}>Accept</button>
          <button type="button" className="text-gray-600 underline underline-offset-2" onClick={() => void call("PATCH", { status: "rejected" })}>Reject</button>
        </>
      )}
      <button type="button" className="text-red-700 underline underline-offset-2" onClick={() => { if (confirm("Remove this entry? The file stays in your evidence.")) void call("DELETE"); }}>Remove</button>
    </div>
    {found && (
      <div className="rounded-md bg-gray-50 p-2 text-[11px] text-gray-700">
        {found.found === 0 ? "Nothing clear found in the file. Fill the details by hand." : (
          <>
            <p className="font-medium">Found in the file</p>
            <p>{LABELS.filter(([k]) => found[k] !== undefined).map(([k, l]) => `${l}: ${found[k]}`).join(" · ")}</p>
            <button type="button" className="mt-1 font-medium text-teal-700 underline underline-offset-2" onClick={() => void apply()}>Fill empty fields</button>
          </>
        )}
      </div>
    )}
    {check && <CarrierResult check={check} />}
    {permit && <PermitResult permit={permit} />}
    {note && <p role="status" className="text-[11px] text-gray-600">{note}</p>}
    </div>
  );
}
