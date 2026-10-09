"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export type CompanyPick = {
  company: { number: string; name: string; status: string | null; postcode: string | null; address: string | null; incorporated: string | null; sicCodes: string[]; jurisdiction: string | null };
  flags: { level: "red" | "amber"; text: string }[];
  smeHint: string | null;
  owners?: { name: string; number: string | null; sharesBand: string | null }[];
};
type Candidate = { number: string; name: string; status: string | null; address: string | null };

/**
 * "Find on Companies House": searches the typed name, lists candidates, and hands the chosen company to the form.
 * The person always picks; nothing is guessed. `getName` reads the form's own name field, so it works with
 * controlled and uncontrolled inputs. `base` is the lookup route: /api/orgs/{orgId}/companies, or /api/companies at sign-up.
 */
export function CompanyFinder({ base, getName, onPick, withOwners = false, label = "Find on Companies House" }: { base: string; getName: () => string; onPick: (p: CompanyPick) => void; withOwners?: boolean; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const name = getName();

  async function find() {
    setBusy(true);
    setNote(null);
    const res = await fetch(`${base}?q=${encodeURIComponent(getName().trim())}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setNote(`${d?.message ?? "Company lookup failed."}${d?.details?.reason ? ` (${d.details.reason}${d.details.detail ? `: ${d.details.detail}` : ""})` : ""}`); setList(null); return; }
    setList(d.candidates);
    if (d.candidates.length === 0) setNote("No company found. Check the name.");
  }
  async function pick(c: Candidate) {
    setBusy(true);
    const res = await fetch(`${base}?number=${c.number}${withOwners ? "&owners=1" : ""}`).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setNote(`${d?.message ?? "Could not read that company."}${d?.details?.reason ? ` (${d.details.reason}${d.details.detail ? `: ${d.details.detail}` : ""})` : ""}`); return; }
    setList(null);
    onPick(d as CompanyPick);
  }
  return (
    <div className="sm:col-span-4">
      <Button type="button" variant="outline" size="sm" disabled={busy || name.trim().length < 3} onClick={() => void find()}>{busy ? "Looking…" : label}</Button>
      {note && <p role="status" className="mt-1 text-xs text-gray-600">{note}</p>}
      {list && list.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
          {list.map((c) => (
            <li key={c.number}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-gray-50" onClick={() => void pick(c)}>
                <span className="font-medium text-gray-900">{c.name}</span> <span className="text-xs text-gray-500">{c.number}{c.status && c.status !== "active" ? ` · ${c.status}` : ""}</span>
                {c.address && <span className="block text-xs text-gray-500">{c.address}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Red and amber register facts as small badges. */
export function CompanyFlags({ flags }: { flags: { level: "red" | "amber"; text: string }[] }) {
  if (flags.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.text} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${f.level === "red" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{f.text}</span>
      ))}
    </span>
  );
}
