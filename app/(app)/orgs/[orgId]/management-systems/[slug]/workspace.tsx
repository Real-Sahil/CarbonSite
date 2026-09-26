"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FrameworkView, RequirementView } from "@/lib/management-systems/load";
import type { RequirementState } from "@/lib/management-systems/readiness";

const STATE_LABELS: Record<RequirementState, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  implemented: "Implemented",
  not_applicable: "Not applicable",
};
const STATE_STYLES: Record<RequirementState, string> = {
  not_started: "bg-[#F3F4F6] text-[#374151]",
  in_progress: "bg-amber-50 text-amber-800",
  implemented: "bg-emerald-50 text-emerald-800",
  not_applicable: "bg-slate-100 text-slate-500",
};
const TONE_STYLES = { ok: "border-emerald-200 bg-emerald-50/50", attention: "border-amber-200 bg-amber-50/60", empty: "border-[#E5E7EB] bg-[#F9FAFB]" };
const ADOPTION_STATUSES: [string, string][] = [["implementing", "Implementing"], ["certified", "Certified"], ["lapsed", "Certificate lapsed"], ["withdrawn", "Withdrawn"]];
const EVIDENCE_KINDS: [string, string][] = [
  ["evidence_file", "Evidence file"],
  ["legal_register_entry", "Legal register entry"],
  ["environmental_aspect", "Environmental aspect"],
  ["environmental_permit", "Permit"],
  ["environmental_incident", "Environmental incident"],
  ["hs_incident_report", "H&S incident"],
  ["method_statement", "Method statement"],
  ["reduction_target", "Reduction target"],
  ["ms_policy", "Policy"],
  ["ms_risk", "Risk or opportunity"],
  ["ms_interested_party", "Interested party"],
  ["ms_audit", "Internal audit"],
  ["ms_audit_finding", "Audit finding"],
  ["ms_corrective_action", "Corrective action"],
  ["ms_management_review", "Management review"],
  ["url", "Link to a web page"],
  ["note", "Written note"],
];
type Filter = "all" | RequirementState | "no_evidence";
const FILTERS: [Filter, string][] = [
  ["all", "All"], ["not_started", "Not started"], ["in_progress", "In progress"], ["implemented", "Implemented"],
  ["no_evidence", "Implemented, no evidence"], ["not_applicable", "Not applicable"],
];
const anchor = (code: string) => `req-${code.replace(/[^A-Za-z0-9]+/g, "-")}`;

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  return { ok: res.ok, message: json?.message as string | undefined };
}

export function FrameworkWorkspace({ orgId, view, canEdit }: { orgId: string; view: FrameworkView; canEdit: boolean }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { framework, adoption, readiness: r } = view;
  const base = `/api/orgs/${orgId}/management-systems/${framework.slug}`;

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = view.requirements.find((q) => anchor(q.code) === hash);
    if (target && !target.heading) setOpen(target.code);
  }, [view.requirements]);

  const assessable = view.requirements.filter((q) => !q.heading);
  const needle = search.trim().toLowerCase();
  const matches = (q: RequirementView) =>
    (filter === "all" || (filter === "no_evidence" ? q.status === "implemented" && q.evidence.length === 0 : q.status === filter)) &&
    (!tag || q.tags.includes(tag)) &&
    (!needle || q.code.toLowerCase().includes(needle) || q.title.toLowerCase().includes(needle) || (q.officialText ?? "").toLowerCase().includes(needle));
  const visibleCodes = useMemo(() => {
    const keep = new Set<string>();
    const byCode = new Map(view.requirements.map((q) => [q.code, q]));
    for (const q of assessable) {
      if (!matches(q)) continue;
      for (let c: string | null = q.code; c; c = byCode.get(c)?.parent ?? null) keep.add(c);
    }
    return keep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, needle, tag, view.requirements]);

  function adopt() {
    startTransition(async () => {
      const res = await send(`/api/orgs/${orgId}/management-systems`, "POST", { frameworkSlug: framework.slug });
      if (!res.ok) return setError(res.message ?? "Could not adopt this framework.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/orgs/${orgId}/management-systems`} className="text-xs text-[#6B7280] hover:text-[#111827]">Management systems</Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#111827]">{framework.name}</h1>
        <p className="text-sm text-[#6B7280]">{framework.edition} · {framework.publisher}{framework.jurisdiction ? ` · ${framework.jurisdiction}` : ""}</p>
        <p className="mt-1 max-w-[80ch] text-xs text-[#6B7280]">
          {framework.contentNote}{" "}
          <a href={framework.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">Source</a>
        </p>
      </div>

      {error && <p role="alert" className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!adoption || adoption.status === "withdrawn" ? (
        <section className="flex flex-col items-start gap-3 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
          <p className="text-sm text-[#374151]">
            {adoption ? "This framework was withdrawn. Adopt it again to carry on where you left off." : "Adopt this framework to assess each requirement and link your evidence."}
          </p>
          {canEdit && (
            <Button size="sm" onClick={adopt} disabled={isPending} className="bg-[#c2410c] text-white hover:bg-[#9a3412]">
              {isPending ? "Adopting…" : adoption ? "Adopt again" : "Adopt"}
            </Button>
          )}
        </section>
      ) : (
        <AdoptionPanel orgId={orgId} base={base} adoption={adoption} readiness={r!} certifiable={framework.certifiable} canEdit={canEdit} />
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="ms-search" className="text-xs">Search</Label>
          <Input id="ms-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code or words" className="h-9 w-64" />
        </div>
        {framework.tagLabels && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="ms-tag" className="text-xs">Show</Label>
            <select id="ms-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
              <option value="">All requirements</option>
              {Object.entries(framework.tagLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter requirements">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${filter === key ? "bg-[#111827] text-white" : "border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB]"}`}
          >
            {label}
            {key !== "all" && (
              <span className="ml-1 tabular-nums opacity-70">
                {key === "no_evidence" ? assessable.filter((q) => q.status === "implemented" && !q.evidence.length).length : assessable.filter((q) => q.status === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <ol className="flex flex-col gap-2">
        {view.requirements
          .filter((q) => visibleCodes.has(q.code))
          .map((q) =>
            q.heading ? (
              <li key={q.code} id={anchor(q.code)} className={q.depth === 0 ? "mt-4 first:mt-0" : "mt-1"} style={{ paddingLeft: `${q.depth * 16}px` }}>
                <p className={q.depth === 0 ? "text-sm font-semibold text-[#111827]" : "text-sm font-medium text-[#374151]"}>
                  <span className="mr-2 font-mono text-xs text-[#6B7280]">{q.code}</span>{q.title}
                </p>
              </li>
            ) : (
              <li key={q.code} id={anchor(q.code)} style={{ paddingLeft: `${q.depth * 16}px` }}>
                <RequirementCard
                  orgId={orgId}
                  base={base}
                  q={q}
                  members={view.members}
                  open={open === q.code}
                  onToggle={() => setOpen(open === q.code ? null : q.code)}
                  canEdit={canEdit && !!adoption && adoption.status !== "withdrawn"}
                />
              </li>
            ),
          )}
      </ol>
      {visibleCodes.size === 0 && <p className="text-sm text-[#6B7280]">No requirements match this filter.</p>}
    </div>
  );
}

function AdoptionPanel({
  base,
  adoption,
  readiness: r,
  certifiable,
  canEdit,
}: {
  orgId: string;
  base: string;
  adoption: NonNullable<FrameworkView["adoption"]>;
  readiness: NonNullable<FrameworkView["readiness"]>;
  certifiable: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: adoption.status,
    scope: adoption.scope ?? "",
    targetDate: adoption.targetDate ?? "",
    certificationBody: adoption.certificationBody ?? "",
    certificateNumber: adoption.certificateNumber ?? "",
    certifiedUntil: adoption.certifiedUntil ?? "",
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const nullIfEmpty = (s: string) => (s.trim() === "" ? null : s.trim());
    startTransition(async () => {
      const res = await send(base, "PATCH", {
        status: form.status,
        scope: nullIfEmpty(form.scope),
        targetDate: nullIfEmpty(form.targetDate),
        ...(certifiable
          ? { certificationBody: nullIfEmpty(form.certificationBody), certificateNumber: nullIfEmpty(form.certificateNumber), certifiedUntil: nullIfEmpty(form.certifiedUntil) }
          : {}),
      });
      if (!res.ok) return setError(res.message ?? "Could not save.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-[#E5E7EB] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[#374151]">Implemented</span>
            <span className="text-lg font-semibold tabular-nums text-[#111827]">{r.percent == null ? "-" : `${r.percent}%`}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden="true">
            <div className="h-full rounded-full bg-[#c2410c]" style={{ width: `${r.percent ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs tabular-nums text-[#6B7280]">
            {r.implemented} of {r.total - r.notApplicable} applicable requirements implemented · {r.inProgress} in progress · {r.notStarted} not started
            {r.notApplicable ? ` · ${r.notApplicable} not applicable` : ""}
          </p>
          {r.implementedWithoutEvidence > 0 && <p className="mt-1 text-xs text-amber-700">{r.implementedWithoutEvidence} implemented without evidence linked</p>}
        </div>
        <div className="flex flex-col gap-1 text-sm text-[#374151]">
          <p>
            <span className="text-[#6B7280]">Status:</span> {ADOPTION_STATUSES.find(([k]) => k === adoption.status)?.[1] ?? adoption.status}
          </p>
          {adoption.targetDate && <p><span className="text-[#6B7280]">Target:</span> {adoption.targetDate}</p>}
          {certifiable && adoption.certificateNumber && (
            <p><span className="text-[#6B7280]">Certificate:</span> {adoption.certificateNumber}{adoption.certificationBody ? ` (${adoption.certificationBody})` : ""}</p>
          )}
          {certifiable && adoption.certifiedUntil && <p><span className="text-[#6B7280]">Valid until:</span> {adoption.certifiedUntil}</p>}
          {canEdit && !editing && (
            <Button size="sm" variant="outline" className="mt-1 self-start" onClick={() => setEditing(true)}>Edit details</Button>
          )}
        </div>
      </div>
      {adoption.scope && !editing && <p className="max-w-[80ch] text-sm text-[#374151]"><span className="text-[#6B7280]">Scope:</span> {adoption.scope}</p>}

      {editing && (
        <form onSubmit={save} className="grid gap-4 border-t border-[#E5E7EB] pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-status">Status</Label>
            <select id="ad-status" value={form.status} onChange={set("status")} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
              {ADOPTION_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ad-target">Target date</Label>
            <Input id="ad-target" type="date" value={form.targetDate} onChange={set("targetDate")} className="h-9" />
          </div>
          {certifiable && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-body">Certification body</Label>
                <Input id="ad-body" value={form.certificationBody} onChange={set("certificationBody")} className="h-9" placeholder="e.g. BSI, NQA, LRQA" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-cert">Certificate number</Label>
                <Input id="ad-cert" value={form.certificateNumber} onChange={set("certificateNumber")} className="h-9" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-until">Certificate valid until</Label>
                <Input id="ad-until" type="date" value={form.certifiedUntil} onChange={set("certifiedUntil")} className="h-9" />
              </div>
            </>
          )}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ad-scope">Scope</Label>
            <Textarea id="ad-scope" value={form.scope} onChange={set("scope")} rows={3} placeholder="Sites, activities and services the system covers" />
          </div>
          {error && <p role="alert" className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function RequirementCard({
  orgId,
  base,
  q,
  members,
  open,
  onToggle,
  canEdit,
}: {
  orgId: string;
  base: string;
  q: RequirementView;
  members: FrameworkView["members"];
  open: boolean;
  onToggle: () => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ status: q.status, ownerUserId: q.ownerUserId ?? "", dueOn: q.dueOn ?? "", notes: q.notes ?? "" });
  const reqUrl = `${base}/requirements/${encodeURIComponent(q.code)}`;

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await send(reqUrl, "PUT", {
        status: form.status,
        ownerUserId: form.ownerUserId || null,
        dueOn: form.dueOn || null,
        notes: form.notes.trim() || null,
      });
      if (!res.ok) return setError(res.message ?? "Could not save.");
      setSaved(true);
      router.refresh();
    });
  }

  function unlink(id: string) {
    startTransition(async () => {
      const res = await send(`${reqUrl}/evidence/${id}`, "DELETE");
      if (!res.ok) return setError(res.message ?? "Could not remove the evidence.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 w-14 shrink-0 font-mono text-xs text-[#6B7280]">{q.code}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[#111827]">{q.title}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6B7280]">
            {q.ownerName && <span>Owner: {q.ownerName}</span>}
            {q.dueOn && <span>Due {q.dueOn}</span>}
            <span>{q.evidence.length} evidence</span>
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${STATE_STYLES[q.status]}`}>{STATE_LABELS[q.status]}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-5 border-t border-[#E5E7EB] p-4">
          {q.guidance && <p className="max-w-[80ch] text-sm leading-relaxed text-[#374151]">{q.guidance}</p>}
          {q.url && (
            <a href={q.url} target="_blank" rel="noreferrer" className="self-start text-sm text-[#111827] underline underline-offset-2">
              Read the official text
            </a>
          )}
          {q.officialText && (
            <details className="text-sm text-[#374151]" open={!q.guidance}>
              <summary className="cursor-pointer text-xs font-medium text-[#6B7280]">Official text</summary>
              <p className="mt-2 max-w-[80ch] whitespace-pre-wrap">{q.officialText}</p>
            </details>
          )}
          {q.examples.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Examples from the source</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[#374151]">{q.examples.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {q.evidenceHints.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Evidence that usually satisfies it</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-[#374151]">{q.evidenceHints.map((h) => <li key={h}>{h}</li>)}</ul>
            </div>
          )}
          {q.signals.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {q.signals.map((s) => (
                <Link key={s.key} href={s.href} className={`rounded-lg border px-3 py-2 text-sm hover:underline ${TONE_STYLES[s.tone]}`}>
                  <span className="block text-xs font-medium text-[#374151]">{s.label}</span>
                  <span className="text-[#111827]">{s.summary}</span>
                </Link>
              ))}
            </div>
          )}
          {q.alsoCovers.length > 0 && (
            <p className="text-xs text-[#6B7280]">
              Same requirement in:{" "}
              {q.alsoCovers.map((c, i) => (
                <span key={`${c.slug}-${c.code}`}>
                  {i > 0 && ", "}
                  <Link href={`/orgs/${orgId}/management-systems/${c.slug}#${anchor(c.code)}`} className="underline underline-offset-2">
                    {c.shortName} {c.code}
                  </Link>{" "}
                  ({STATE_LABELS[c.status].toLowerCase()})
                </span>
              ))}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">Evidence</p>
            {q.evidence.length === 0 ? (
              <p className="text-sm text-[#6B7280]">None linked yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#F3F4F6] rounded-lg border border-[#E5E7EB]">
                {q.evidence.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="text-xs text-[#6B7280]">{e.kindLabel}: </span>
                      {e.href ? (
                        <a href={e.href} target={e.kind === "url" ? "_blank" : undefined} rel="noreferrer" className="break-words text-[#111827] underline underline-offset-2">{e.label}</a>
                      ) : (
                        <span className="text-[#111827]">{e.label}</span>
                      )}
                      {e.note && <span className="block whitespace-pre-line text-xs text-[#6B7280]">{e.note}</span>}
                    </span>
                    {canEdit && (
                      <button type="button" onClick={() => unlink(e.id)} disabled={isPending} className="shrink-0 text-xs text-[#6B7280] hover:text-red-600">Remove</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEdit && <AddEvidence orgId={orgId} reqUrl={reqUrl} onError={setError} />}
          </div>

          {canEdit ? (
            <form onSubmit={save} className="grid gap-3 border-t border-[#E5E7EB] pt-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`st-${q.code}`}>Status</Label>
                <select id={`st-${q.code}`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RequirementState })} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
                  {Object.entries(STATE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`ow-${q.code}`}>Owner</Label>
                <select id={`ow-${q.code}`} value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
                  <option value="">Nobody yet</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`du-${q.code}`}>Due</Label>
                <Input id={`du-${q.code}`} type="date" value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} className="h-9" />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-3">
                <Label htmlFor={`no-${q.code}`}>{form.status === "not_applicable" ? "Why it does not apply (required)" : "How you meet it"}</Label>
                <Textarea id={`no-${q.code}`} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>
              {error && <p role="alert" className="text-sm text-red-600 sm:col-span-3">{error}</p>}
              <div className="flex items-center gap-3 sm:col-span-3">
                <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Saving…" : "Save"}</Button>
                {saved && <span role="status" className="text-xs text-emerald-700">Saved</span>}
              </div>
            </form>
          ) : (
            q.notes && <p className="whitespace-pre-line border-t border-[#E5E7EB] pt-4 text-sm text-[#374151]">{q.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

function AddEvidence({ orgId, reqUrl, onError }: { orgId: string; reqUrl: string; onError: (m: string | null) => void }) {
  const router = useRouter();
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const isRecord = kind !== "" && kind !== "url" && kind !== "note";

  useEffect(() => {
    if (!isRecord) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/orgs/${orgId}/management-systems/records?kind=${kind}&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((j) => setOptions(j.data ?? []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [orgId, kind, q, isRecord]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    const body = isRecord ? { kind, targetId, note: note || undefined } : kind === "url" ? { kind, url, label, note: note || undefined } : { kind, label, note: note || undefined };
    startTransition(async () => {
      const res = await send(`${reqUrl}/evidence`, "POST", body);
      if (!res.ok) return onError(res.message ?? "Could not link the evidence.");
      setKind("");
      setQ("");
      setTargetId("");
      setLabel("");
      setUrl("");
      setNote("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-2 rounded-lg bg-[#F9FAFB] p-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`ek-${reqUrl}`} className="text-xs">Add evidence</Label>
          <select id={`ek-${reqUrl}`} value={kind} onChange={(e) => { setKind(e.target.value); setTargetId(""); setOptions([]); }} className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
            <option value="">Choose a type…</option>
            {EVIDENCE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        {isRecord && (
          <>
            <Input aria-label="Search records" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-9 w-40 bg-white" />
            <select aria-label="Record" value={targetId} onChange={(e) => setTargetId(e.target.value)} className="h-9 min-w-[200px] max-w-full rounded-md border border-[#E5E7EB] bg-white px-2 text-sm">
              <option value="">{options.length ? "Choose a record…" : "No records found"}</option>
              {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </>
        )}
        {kind === "url" && <Input aria-label="Web address" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className="h-9 w-64 bg-white" />}
        {(kind === "url" || kind === "note") && <Input aria-label="Title" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Title" className="h-9 w-56 bg-white" />}
      </div>
      {kind && (
        <>
          <Textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={kind === "note" ? "What the evidence is and where it is kept" : "Optional note"} className="bg-white" />
          <Button type="submit" size="sm" disabled={isPending || (isRecord ? !targetId : !label || (kind === "url" && !url))} className="self-start">
            {isPending ? "Linking…" : "Link evidence"}
          </Button>
        </>
      )}
    </form>
  );
}
