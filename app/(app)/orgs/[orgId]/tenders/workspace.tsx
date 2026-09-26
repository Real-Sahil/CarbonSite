"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WatchView = {
  enabled: boolean;
  cpvPrefixes: string[];
  regions: string[];
  keywords: string[];
  minValue: number | null;
  lastCheckedAt: string | null;
};
export type OpportunityView = {
  id: string;
  noticeId: string;
  title: string;
  buyerName: string | null;
  value: number | null;
  currency: string | null;
  deadline: string | null;
  publishedAt: string;
  regions: string[];
  matchedOn: string;
  flags: { code: string; level: "likely" | "possible"; label: string; reason: string }[];
  status: string;
};

/** Common CPV divisions and groups for construction and related services. */
const CPV_PRESETS: [string, string][] = [
  ["45", "Construction work"],
  ["4523", "Pipelines, power lines, highways, roads, railways"],
  ["45233", "Road construction"],
  ["4524", "Water projects"],
  ["4531", "Electrical installation"],
  ["5023", "Repair and maintenance of roads"],
  ["71", "Architectural and engineering services"],
  ["90", "Refuse, cleaning and environmental services"],
];
/** ITL 1 regions, as Find a Tender gives them. */
const REGIONS: [string, string][] = [
  ["UKC", "North East"], ["UKD", "North West"], ["UKE", "Yorkshire and the Humber"], ["UKF", "East Midlands"],
  ["UKG", "West Midlands"], ["UKH", "East of England"], ["UKI", "London"], ["UKJ", "South East"],
  ["UKK", "South West"], ["UKL", "Wales"], ["UKM", "Scotland"], ["UKN", "Northern Ireland"],
];
const STATUSES: [string, string][] = [["new", "New"], ["interested", "Interested"], ["bidding", "Bidding"], ["dismissed", "Not for us"]];

const money = (v: number | null, c: string | null) =>
  v == null ? "Value not given" : new Intl.NumberFormat("en-GB", { style: "currency", currency: c ?? "GBP", maximumFractionDigits: 0 }).format(v);
const dateText = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "No deadline given";
const daysLeft = (iso: string | null) => (iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);
const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function TendersWorkspace({
  orgId,
  canEdit,
  planIncludes,
  watch,
  opportunities,
}: {
  orgId: string;
  canEdit: boolean;
  planIncludes: boolean;
  watch: WatchView | null;
  opportunities: OpportunityView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState(!watch);
  const [cpv, setCpv] = useState<string[]>(watch?.cpvPrefixes ?? ["45"]);
  const [customCpv, setCustomCpv] = useState((watch?.cpvPrefixes ?? []).filter((c) => !CPV_PRESETS.some(([p]) => p === c)).join(", "));
  const [regions, setRegions] = useState<string[]>(watch?.regions ?? []);
  const [keywords, setKeywords] = useState((watch?.keywords ?? []).join(", "));
  const [minValue, setMinValue] = useState(watch?.minValue != null ? String(watch.minValue) : "");
  const [enabled, setEnabled] = useState(watch?.enabled ?? true);
  const [showDismissed, setShowDismissed] = useState(false);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function saveWatch(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const cpvPrefixes = [...new Set([...cpv.filter((c) => CPV_PRESETS.some(([p]) => p === c)), ...splitList(customCpv).map((c) => c.replace(/\D/g, "")).filter(Boolean)])];
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/tenders/watch`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, cpvPrefixes, regions, keywords: splitList(keywords), minValue: minValue === "" ? null : Number(minValue) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) return setMessage({ kind: "error", text: json?.message ?? "Could not save the watch." });
      setEditing(false);
      setMessage({ kind: "ok", text: "Watch saved. Checking Find a Tender now…" });
      const check = await fetch(`/api/orgs/${orgId}/tenders/check`, { method: "POST" });
      const result = await check.json().catch(() => null);
      setMessage(
        check.ok
          ? { kind: "ok", text: `Checked ${result.notices} open notices from the last ${watch?.lastCheckedAt ? "check" : "7 days"}: ${result.added} new match${result.added === 1 ? "" : "es"}.` }
          : { kind: "error", text: result?.message ?? "Saved, but Find a Tender could not be checked. The daily check will try again." },
      );
      router.refresh();
    });
  }

  function checkNow() {
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/tenders/check`, { method: "POST" });
      const json = await res.json().catch(() => null);
      setMessage(res.ok ? { kind: "ok", text: `${json.added} new match${json.added === 1 ? "" : "es"} from ${json.notices} open notices.` } : { kind: "error", text: json?.message ?? "Could not check Find a Tender." });
      router.refresh();
    });
  }

  function setStatus(id: string, status: string) {
    startTransition(async () => {
      const res = await fetch(`/api/orgs/${orgId}/tenders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) setMessage({ kind: "error", text: "Could not update the tender." });
      router.refresh();
    });
  }

  const visible = opportunities.filter((o) => showDismissed || o.status !== "dismissed");
  const dismissed = opportunities.length - opportunities.filter((o) => o.status !== "dismissed").length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">Tenders</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-[#6B7280]">
          Open public contracts from Find a Tender that match your work, checked every morning. Each one says whether the buyer is
          likely to ask for a Carbon Reduction Plan or social value, so you can start the bid carbon pack early.
        </p>
      </div>

      {!planIncludes && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">Tender watch is part of the Growth plan and above.</p>
      )}

      <section className="rounded-[14px] border border-[#E5E7EB] p-5">
        {!editing && watch ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm text-[#374151]">
              <p className="font-medium text-[#111827]">{watch.enabled ? "Watching" : "Paused"}</p>
              <p>CPV: {watch.cpvPrefixes.join(", ") || "none"}{watch.keywords.length ? ` · Keywords: ${watch.keywords.join(", ")}` : ""}</p>
              <p>
                Regions: {watch.regions.length ? watch.regions.map((r) => REGIONS.find(([c]) => c === r)?.[1] ?? r).join(", ") : "anywhere"}
                {watch.minValue != null ? ` · From ${money(watch.minValue, "GBP")}` : ""}
              </p>
              <p className="text-xs text-[#6B7280]">Last checked: {watch.lastCheckedAt ? new Date(watch.lastCheckedAt).toLocaleString("en-GB") : "not yet"}</p>
            </div>
            {canEdit && planIncludes && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={checkNow} disabled={isPending || !watch.enabled}>{isPending ? "Checking…" : "Check now"}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edit watch</Button>
              </div>
            )}
          </div>
        ) : canEdit && planIncludes ? (
          <form onSubmit={saveWatch} className="flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-[#111827]">Work you bid for (CPV codes)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {CPV_PRESETS.map(([code, name]) => (
                  <label key={code} className="flex items-center gap-2 text-sm text-[#374151]">
                    <input type="checkbox" checked={cpv.includes(code)} onChange={() => setCpv(toggle(cpv, code))} className="h-4 w-4" />
                    <span className="font-mono text-xs text-[#6B7280]">{code}</span> {name}
                  </label>
                ))}
              </div>
              <div className="flex max-w-md flex-col gap-1.5">
                <Label htmlFor="tw-cpv" className="text-xs text-[#374151]">Other CPV codes or prefixes</Label>
                <Input id="tw-cpv" value={customCpv} onChange={(e) => setCustomCpv(e.target.value)} placeholder="e.g. 45453, 4526" className="h-9 text-sm" />
              </div>
            </fieldset>
            <div className="flex max-w-md flex-col gap-1.5">
              <Label htmlFor="tw-keywords" className="text-sm font-medium text-[#111827]">Title keywords</Label>
              <Input id="tw-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="e.g. resurfacing, drainage, bridge" className="h-9 text-sm" />
              <p className="text-xs text-[#6B7280]">A notice with one of these words in its title matches whatever its CPV code.</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[#111827]">Regions (none ticked: anywhere)</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {REGIONS.map(([code, name]) => (
                  <label key={code} className="flex items-center gap-2 text-sm text-[#374151]">
                    <input type="checkbox" checked={regions.includes(code)} onChange={() => setRegions(toggle(regions, code))} className="h-4 w-4" />
                    {name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tw-min" className="text-sm font-medium text-[#111827]">Minimum value (£)</Label>
                <Input id="tw-min" type="number" min={0} value={minValue} onChange={(e) => setMinValue(e.target.value)} placeholder="Any" className="h-9 w-44 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#374151]">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />
                Check every morning
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save and check"}</Button>
              {watch && <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>Cancel</Button>}
            </div>
          </form>
        ) : (
          <p className="text-sm text-[#6B7280]">No tender watch set up yet. An admin or contract manager can set one up.</p>
        )}
        {message && <p className={`mt-3 text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-600"}`}>{message.text}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#111827]">Open tenders ({visible.length})</h2>
          {dismissed > 0 && (
            <label className="flex items-center gap-2 text-sm text-[#6B7280]">
              <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} className="h-4 w-4" />
              Show {dismissed} marked not for us
            </label>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="rounded-[14px] border border-dashed border-[#E5E7EB] p-8 text-center text-sm text-[#6B7280]">
            {watch ? "No open tenders match yet. New notices are checked every morning." : "Set up a watch above to see matching tenders."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((o) => {
              const left = daysLeft(o.deadline);
              const bidHref = `/orgs/${orgId}/reports?${new URLSearchParams({ bid: "1", bidTitle: o.title.slice(0, 200), buyerName: o.buyerName ?? "", tenderReference: o.noticeId })}`;
              return (
                <li key={o.id} className={`rounded-[14px] border border-[#E5E7EB] p-4 ${o.status === "dismissed" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <a href={`https://www.find-tender.service.gov.uk/Notice/${o.noticeId}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#111827] hover:underline">
                        {o.title}
                      </a>
                      <p className="mt-0.5 text-sm text-[#6B7280]">
                        {o.buyerName ?? "Buyer not given"} · {money(o.value, o.currency)} · Matched on {o.matchedOn}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className={left != null && left <= 7 ? "font-medium text-red-700" : "text-[#374151]"}>
                        {o.deadline ? `Closes ${dateText(o.deadline)}` : dateText(null)}
                      </p>
                      {left != null && <p className="text-xs text-[#6B7280]">{left} day{left === 1 ? "" : "s"} left</p>}
                    </div>
                  </div>
                  {o.flags.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {o.flags.map((f) => (
                        <li
                          key={f.code}
                          title={f.reason}
                          className={`rounded-full px-2.5 py-0.5 text-xs ${f.level === "likely" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700"}`}
                        >
                          {f.label}: {f.level}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {canEdit && (
                      <select
                        aria-label="Status"
                        value={o.status}
                        onChange={(e) => setStatus(o.id, e.target.value)}
                        disabled={isPending}
                        className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm"
                      >
                        {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link href={bidHref}>Start bid carbon pack</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-[#6B7280]">
          Notices from Find a Tender (find-tender.service.gov.uk), Open Government Licence v3.0. Carbon Reduction Plan and social value flags are read from the buyer type and value on the notice; the tender documents decide.
        </p>
      </section>
    </div>
  );
}
