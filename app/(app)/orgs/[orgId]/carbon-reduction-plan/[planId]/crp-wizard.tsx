"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2, Menu, Plus, Save, Trash2 } from "lucide-react";
import {
  CheckRow,
  FieldRow,
  SectionNav,
  SectionPager,
  inputCls,
  labelCls,
  textareaCls,
  type NavSection,
} from "@/components/structured-forms/ms-fields";
import { BOUNDARY_APPROACHES, SCOPE3_STATUSES, type CrpCheck, type CrpSectionKey, type CrpSections } from "@/lib/crp/plan";

// ── Types from GET /carbon-reduction-plans/[planId] (dates arrive as strings) ─

type Totals = { s1: number; s2: number; s2Market: number | null; s3: number; total: number };
type Context = {
  period: { id: string; label: string; startDate: string; endDate: string };
  records: { total: number; approved: number; byScope: Record<"1" | "2" | "3", number> };
  latestRun: { id: string; status: string; finishedAt: string | null } | null;
  snapshot: { id: string; version: number; publishedAt: string; calculationRunId: string; reviewStatus: string; totals: Totals } | null;
  unpublishedRun: boolean;
  ppnScope3: { code: string; label: string; tonnes: number | null }[];
  baseYear: {
    id: string;
    label: string;
    status: string;
    periodLabel: string;
    endYear: number;
    s1: number | null;
    s2: number | null;
    s3: number | null;
    total: number | null;
  } | null;
  initiatives: { name: string; status: string; expectedTonnes: number | null }[];
  runDefaults: { factorLibraryId: string; methodologyVersionId: string } | null;
};
type Loaded = {
  plan: { id: string; status: string; updatedAt: string; lastReportId: string | null; sections: CrpSections };
  context: Context;
  checks: CrpCheck[];
  ready: boolean;
};

type SectionKey = CrpSectionKey | "review";

const SECTIONS: { key: SectionKey; label: string; optional?: boolean }[] = [
  { key: "period", label: "Period and data" },
  { key: "organisation", label: "Supplier and boundary" },
  { key: "emissions", label: "Emissions" },
  { key: "baseline", label: "Baseline" },
  { key: "targets", label: "Net zero and targets" },
  { key: "measures", label: "Reduction projects" },
  { key: "secr", label: "SECR (optional)", optional: true },
  { key: "declaration", label: "Declaration" },
  { key: "review", label: "Check and generate" },
];

const fmtT = (v: number | null | undefined) =>
  v == null ? "None" : `${v.toLocaleString("en-GB", { maximumFractionDigits: v < 10 ? 2 : 1 })} tCO₂e`;
const rid = () => Math.random().toString(36).slice(2, 10);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? `Request failed (${res.status}).`);
  return body as T;
}

// ── Small building blocks ──────────────────────────────────────────────────────

function Note({ tone = "info", children }: { tone?: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const cls =
    tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : tone === "ok" ? "border-green-200 bg-green-50 text-green-900" : "border-gray-200 bg-gray-50 text-gray-700";
  return <div className={`rounded border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

function Checks({ checks, section }: { checks: CrpCheck[]; section: CrpSectionKey }) {
  const mine = checks.filter((c) => c.section === section);
  if (!mine.length) return null;
  return (
    <ul className="space-y-1.5 rounded border border-gray-200 bg-white p-3">
      {mine.map((c) => (
        <li key={c.id} className="flex gap-2 text-sm">
          {c.passed ? (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
          ) : (
            <AlertCircle aria-hidden="true" className={`mt-0.5 h-4 w-4 flex-shrink-0 ${c.required ? "text-red-600" : "text-amber-600"}`} />
          )}
          <span>
            <span className={c.passed ? "text-gray-700" : "text-gray-900"}>
              {c.label}
              {!c.passed ? <span className="ml-1 text-xs text-gray-500">({c.required ? "required" : "recommended"})</span> : null}
            </span>
            {c.fix ? <span className="block text-xs text-gray-600">{c.fix}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function MeasureRows({
  rows,
  onChange,
  disabled,
  idPrefix,
  yearLabel,
}: {
  rows: CrpSections["measures"]["completed"];
  onChange: (rows: CrpSections["measures"]["completed"]) => void;
  disabled: boolean;
  idPrefix: string;
  yearLabel: string;
}) {
  const set = (id: string, k: keyof (typeof rows)[number], v: string) => onChange(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      {rows.length === 0 ? <p className="text-xs text-gray-400">None added.</p> : null}
      {rows.map((m, i) => (
        <div key={m.id} className="rounded border border-gray-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_110px_150px_32px]">
            <FieldRow label={`Measure ${i + 1}`} htmlFor={`${idPrefix}-${m.id}-name`}>
              <input id={`${idPrefix}-${m.id}-name`} className={inputCls} disabled={disabled} value={m.name} placeholder="e.g. HVO in all site plant" onChange={(e) => set(m.id, "name", e.target.value)} />
            </FieldRow>
            <FieldRow label={yearLabel} htmlFor={`${idPrefix}-${m.id}-year`}>
              <input id={`${idPrefix}-${m.id}-year`} type="number" min={2000} max={2100} className={inputCls} disabled={disabled} value={m.year} onChange={(e) => set(m.id, "year", e.target.value)} />
            </FieldRow>
            <FieldRow label="Est. saving a year (tCO₂e)" htmlFor={`${idPrefix}-${m.id}-saving`}>
              <input id={`${idPrefix}-${m.id}-saving`} type="number" min={0} step="any" className={inputCls} disabled={disabled} value={m.savingTco2e} onChange={(e) => set(m.id, "savingTco2e", e.target.value)} />
            </FieldRow>
            {!disabled ? (
              <button type="button" aria-label={`Remove measure ${i + 1}`} onClick={() => onChange(rows.filter((r) => r.id !== m.id))} className="mt-5 flex h-9 w-8 items-center justify-center rounded border border-gray-200 hover:bg-gray-50">
                <Trash2 className="h-3.5 w-3.5 text-gray-500" />
              </button>
            ) : null}
          </div>
          <div className="mt-3">
            <FieldRow label="What was done and how the saving was estimated" htmlFor={`${idPrefix}-${m.id}-desc`}>
              <textarea id={`${idPrefix}-${m.id}-desc`} rows={2} className={textareaCls} disabled={disabled} value={m.description} onChange={(e) => set(m.id, "description", e.target.value)} />
            </FieldRow>
          </div>
        </div>
      ))}
      {!disabled ? (
        <button
          type="button"
          onClick={() => onChange([...rows, { id: rid(), name: "", year: "", description: "", savingTco2e: "" }])}
          className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:text-gray-900"
        >
          <Plus className="h-3 w-3" /> Add measure
        </button>
      ) : null}
    </div>
  );
}

// ── The guided plan ───────────────────────────────────────────────────────────

export function CrpWizard({
  orgId,
  planId,
  canEdit,
  canSetBaseYear,
  periods,
}: {
  orgId: string;
  planId: string;
  canEdit: boolean;
  canSetBaseYear: boolean;
  periods: { id: string; label: string }[];
}) {
  const base = `/api/orgs/${orgId}`;
  const [data, setData] = useState<Loaded | null>(null);
  const [sections, setSections] = useState<CrpSections | null>(null);
  const [active, setActive] = useState<SectionKey>("period");
  const [navOpen, setNavOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ crp: string; secr?: string } | null>(null);
  const [pending, setPending] = useState(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const d = await api<Loaded>(`${base}/carbon-reduction-plans/${planId}`);
    setData(d);
    if (!dirty.current) setSections(d.plan.sections);
    return d;
  }, [base, planId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "The plan could not be loaded."));
  }, [load]);

  const save = useCallback(
    async (next: CrpSections) => {
      setSaveState("saving");
      try {
        await api(`${base}/carbon-reduction-plans/${planId}`, { method: "PATCH", body: JSON.stringify({ sections: next }) });
        dirty.current = false;
        setPending(false);
        setSaveState("saved");
        await load();
      } catch (e) {
        setSaveState("error");
        setError(e instanceof Error ? e.message : "The plan could not be saved.");
      }
    },
    [base, planId, load],
  );

  const update = useCallback(
    (fn: (s: CrpSections) => CrpSections) => {
      setSections((prev) => {
        if (!prev) return prev;
        const next = fn(prev);
        dirty.current = true;
        setPending(true);
        setSaveState("idle");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(next), 1200);
        return next;
      });
    },
    [save],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const run = useCallback(
    async (label: string, fn: () => Promise<unknown>) => {
      setBusy(label);
      setError(null);
      try {
        await fn();
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That did not work.");
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const nav: NavSection<SectionKey>[] = useMemo(() => {
    const checks = data?.checks ?? [];
    return SECTIONS.map((s) => {
      if (s.key === "review") return { key: s.key, label: s.label, state: data?.ready ? "done" : "todo" };
      const mine = checks.filter((c) => c.section === s.key && c.required);
      const done = mine.every((c) => c.passed);
      return { key: s.key, label: s.label, state: s.optional && done ? "optional" : done ? "done" : "todo" };
    });
  }, [data]);

  if (error && !data) return <div className="p-8 text-sm text-red-700">{error}</div>;
  if (!data || !sections) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading plan…
      </div>
    );
  }

  const ctx = data.context;
  const s = sections;
  const disabled = !canEdit;
  const required = data.checks.filter((c) => c.required);
  const passedRequired = required.filter((c) => c.passed).length;

  // ── Section bodies ─────────────────────────────────────────────────────────

  const period = (
    <div className="space-y-5">
      <p className="text-sm text-gray-700">
        This plan reports <strong>{ctx.period.label}</strong> (
        {new Date(ctx.period.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} to{" "}
        {new Date(ctx.period.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}). PPN 006 asks for your most recent
        complete year.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Activity records" value={ctx.records.total.toLocaleString("en-GB")} />
        <Stat label="Scope 1 records" value={ctx.records.byScope["1"].toLocaleString("en-GB")} />
        <Stat label="Scope 2 records" value={ctx.records.byScope["2"].toLocaleString("en-GB")} />
        <Stat label="Scope 3 records" value={ctx.records.byScope["3"].toLocaleString("en-GB")} />
      </div>
      <p className="text-sm text-gray-600">
        {ctx.records.approved.toLocaleString("en-GB")} of {ctx.records.total.toLocaleString("en-GB")} records are approved. Add missing data under{" "}
        <Link className="text-[#c2410c] underline" href={`/orgs/${orgId}/imports`}>
          Imports
        </Link>
        ,{" "}
        <Link className="text-[#c2410c] underline" href={`/orgs/${orgId}/records`}>
          Records
        </Link>{" "}
        or{" "}
        <Link className="text-[#c2410c] underline" href={`/orgs/${orgId}/submissions`}>
          Submissions
        </Link>
        , then come back to this plan.
      </p>
      <Checks checks={data.checks} section="period" />
    </div>
  );

  const organisation = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FieldRow label="Company number" htmlFor="crp-company">
          <input id="crp-company" className={inputCls} disabled={disabled} value={s.organisation.companyNumber} placeholder="e.g. 01234567" onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, companyNumber: e.target.value } }))} />
        </FieldRow>
        <FieldRow label="Organisational boundary" htmlFor="crp-boundary" hint="Operational control is the usual choice for contractors.">
          <select id="crp-boundary" className={inputCls} disabled={disabled} value={s.organisation.boundaryApproach} onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, boundaryApproach: e.target.value as CrpSections["organisation"]["boundaryApproach"] } }))}>
            {BOUNDARY_APPROACHES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>
      <FieldRow label="Web page where the plan will be published *" htmlFor="crp-url" hint="PPN 006 requires the plan to be published on your website and kept up to date.">
        <input id="crp-url" type="url" className={inputCls} disabled={disabled} value={s.organisation.publicationUrl} placeholder="https://www.example.co.uk/carbon-reduction-plan" onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, publicationUrl: e.target.value } }))} />
      </FieldRow>
      <FieldRow label="About the organisation" htmlFor="crp-desc" hint="What you do and where, in two or three sentences.">
        <textarea id="crp-desc" rows={3} className={textareaCls} disabled={disabled} value={s.organisation.description} onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, description: e.target.value } }))} />
      </FieldRow>
      <FieldRow label="Sites, companies and activities covered *" htmlFor="crp-sites" hint="For example: head office, two depots and all UK construction sites of the named company and its subsidiaries.">
        <textarea id="crp-sites" rows={3} className={textareaCls} disabled={disabled} value={s.organisation.sitesIncluded} onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, sitesIncluded: e.target.value } }))} />
      </FieldRow>
      <div>
        <p className={labelCls}>Exclusions</p>
        <p className="mb-2 text-xs text-gray-500">Anything inside the boundary that is not reported, with the reason (for example immaterial, or data not available).</p>
        <div className="space-y-2">
          {s.organisation.exclusions.map((ex, i) => (
            <div key={ex.id} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_32px]">
              <input aria-label={`Exclusion ${i + 1}`} className={inputCls} disabled={disabled} value={ex.item} placeholder="Excluded site or activity" onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, exclusions: p.organisation.exclusions.map((x) => (x.id === ex.id ? { ...x, item: e.target.value } : x)) } }))} />
              <input aria-label={`Reason for exclusion ${i + 1}`} className={inputCls} disabled={disabled} value={ex.reason} placeholder="Reason" onChange={(e) => update((p) => ({ ...p, organisation: { ...p.organisation, exclusions: p.organisation.exclusions.map((x) => (x.id === ex.id ? { ...x, reason: e.target.value } : x)) } }))} />
              {!disabled ? (
                <button type="button" aria-label={`Remove exclusion ${i + 1}`} onClick={() => update((p) => ({ ...p, organisation: { ...p.organisation, exclusions: p.organisation.exclusions.filter((x) => x.id !== ex.id) } }))} className="flex h-9 w-8 items-center justify-center rounded border border-gray-200 hover:bg-gray-50">
                  <Trash2 className="h-3.5 w-3.5 text-gray-500" />
                </button>
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <button type="button" onClick={() => update((p) => ({ ...p, organisation: { ...p.organisation, exclusions: [...p.organisation.exclusions, { id: rid(), item: "", reason: "" }] } }))} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:text-gray-900">
              <Plus className="h-3 w-3" /> Add exclusion
            </button>
          ) : null}
        </div>
      </div>
      <Checks checks={data.checks} section="organisation" />
    </div>
  );

  const latestSucceeded = ctx.latestRun?.status === "succeeded" ? ctx.latestRun : null;
  const emissions = (
    <div className="space-y-5">
      {ctx.snapshot ? (
        <Note tone={ctx.unpublishedRun ? "warn" : "ok"}>
          Published snapshot v{ctx.snapshot.version}, {new Date(ctx.snapshot.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
          {ctx.unpublishedRun ? " A newer calculation has not been published yet." : " The plan will print these figures."}
        </Note>
      ) : (
        <Note tone="warn">No published figures for this period yet. Calculate, then publish, so the plan has figures that cannot change underneath it.</Note>
      )}
      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy || !ctx.runDefaults || ctx.records.total === 0}
            onClick={() =>
              run("calculate", () =>
                api(`${base}/calculation-runs`, { method: "POST", body: JSON.stringify({ reportingPeriodId: ctx.period.id, ...ctx.runDefaults }) }),
              )
            }
            className="flex items-center gap-1 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {busy === "calculate" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Calculate {ctx.period.label}
          </button>
          <button
            type="button"
            disabled={!!busy || !latestSucceeded || (ctx.snapshot?.calculationRunId === latestSucceeded.id)}
            onClick={() =>
              run("publish", () =>
                api(`${base}/snapshots`, { method: "POST", body: JSON.stringify({ reportingPeriodId: ctx.period.id, calculationRunId: latestSucceeded!.id }) }),
              )
            }
            className="flex items-center gap-1 rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Publish latest calculation
          </button>
          {ctx.latestRun && ctx.latestRun.status !== "succeeded" ? <span className="self-center text-xs text-gray-600">Latest run: {ctx.latestRun.status}</span> : null}
        </div>
      ) : null}
      {ctx.snapshot ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Scope 1" value={fmtT(ctx.snapshot.totals.s1)} />
          <Stat label="Scope 2 (location-based)" value={fmtT(ctx.snapshot.totals.s2)} />
          <Stat label="Scope 3" value={fmtT(ctx.snapshot.totals.s3)} />
          <Stat label="Total" value={fmtT(ctx.snapshot.totals.total)} />
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium text-gray-900">Scope 3 categories PPN 006 requires</p>
        <p className="mb-3 text-xs text-gray-600">Each must be reported, or its absence explained. Categories with emissions in the published figures are reported automatically.</p>
        <div className="space-y-3">
          {ctx.ppnScope3.map((c) => {
            const row = s.scope3.find((r) => r.code === c.code)!;
            const hasData = c.tonnes != null && c.tonnes > 0;
            return (
              <div key={c.code} className="rounded border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-900">{c.label}</p>
                  <p className="text-sm tabular-nums text-gray-700">{hasData ? fmtT(c.tonnes) : "No emissions recorded"}</p>
                </div>
                {!hasData ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-[220px_1fr]">
                    <FieldRow label="Status" htmlFor={`s3-${c.code}-status`}>
                      <select id={`s3-${c.code}-status`} className={inputCls} disabled={disabled} value={row.status} onChange={(e) => update((p) => ({ ...p, scope3: p.scope3.map((r) => (r.code === c.code ? { ...r, status: e.target.value as typeof r.status } : r)) }))}>
                        {SCOPE3_STATUSES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </FieldRow>
                    <FieldRow label="Explanation" htmlFor={`s3-${c.code}-why`}>
                      <input id={`s3-${c.code}-why`} className={inputCls} disabled={disabled} value={row.explanation} placeholder={row.status === "not_relevant" ? "e.g. We do not deliver goods to customers." : "e.g. Staff travel survey under way; reported from next year."} onChange={(e) => update((p) => ({ ...p, scope3: p.scope3.map((r) => (r.code === c.code ? { ...r, explanation: e.target.value } : r)) }))} />
                    </FieldRow>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <Checks checks={data.checks} section="emissions" />
    </div>
  );

  const baseline = (
    <BaselineSection
      ctx={ctx}
      s={s}
      disabled={disabled}
      canSetBaseYear={canSetBaseYear}
      periods={periods}
      busy={busy}
      onRun={run}
      base={base}
      update={update}
      checks={data.checks}
    />
  );

  const targets = (
    <div className="space-y-4">
      <FieldRow label="Net zero year *" htmlFor="crp-nz" hint="No later than 2050. Many contractors commit to 2045 or earlier.">
        <input id="crp-nz" type="number" min={2025} max={2050} className={`${inputCls} max-w-[160px]`} disabled={disabled} value={s.targets.netZeroYear} onChange={(e) => update((p) => ({ ...p, targets: { ...p.targets, netZeroYear: e.target.value === "" ? "" : Number(e.target.value) } }))} />
      </FieldRow>
      <div>
        <p className={labelCls}>Interim reduction targets</p>
        <p className="mb-2 text-xs text-gray-500">Percentage reduction against the baseline, by a year after this period. For example 50% of Scope 1 and 2 by 2030.</p>
        <div className="space-y-2">
          {s.targets.interim.map((t, i) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[120px_140px_1fr_32px]">
              <input aria-label={`Target ${i + 1} year`} type="number" min={2025} max={2100} className={inputCls} disabled={disabled} value={t.year} placeholder="Year" onChange={(e) => update((p) => ({ ...p, targets: { ...p.targets, interim: p.targets.interim.map((x) => (x.id === t.id ? { ...x, year: e.target.value === "" ? "" : Number(e.target.value) } : x)) } }))} />
              <input aria-label={`Target ${i + 1} reduction percent`} type="number" min={1} max={100} step="any" className={inputCls} disabled={disabled} value={t.reductionPct} placeholder="% reduction" onChange={(e) => update((p) => ({ ...p, targets: { ...p.targets, interim: p.targets.interim.map((x) => (x.id === t.id ? { ...x, reductionPct: e.target.value === "" ? "" : Number(e.target.value) } : x)) } }))} />
              <select aria-label={`Target ${i + 1} scopes`} className={inputCls} disabled={disabled} value={t.scopes} onChange={(e) => update((p) => ({ ...p, targets: { ...p.targets, interim: p.targets.interim.map((x) => (x.id === t.id ? { ...x, scopes: e.target.value as typeof x.scopes } : x)) } }))}>
                <option value="s1s2">Scopes 1 and 2</option>
                <option value="s1s2s3">Scopes 1, 2 and 3</option>
              </select>
              {!disabled ? (
                <button type="button" aria-label={`Remove target ${i + 1}`} onClick={() => update((p) => ({ ...p, targets: { ...p.targets, interim: p.targets.interim.filter((x) => x.id !== t.id) } }))} className="flex h-9 w-8 items-center justify-center rounded border border-gray-200 hover:bg-gray-50">
                  <Trash2 className="h-3.5 w-3.5 text-gray-500" />
                </button>
              ) : null}
            </div>
          ))}
          {!disabled ? (
            <button type="button" onClick={() => update((p) => ({ ...p, targets: { ...p.targets, interim: [...p.targets.interim, { id: rid(), year: "", reductionPct: "", scopes: "s1s2" }] } }))} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:text-gray-900">
              <Plus className="h-3 w-3" /> Add target
            </button>
          ) : null}
        </div>
      </div>
      <CheckRow id="crp-sbti" label="These targets have been validated by the Science Based Targets initiative" checked={s.targets.sbtiValidated} disabled={disabled} onChange={(v) => update((p) => ({ ...p, targets: { ...p.targets, sbtiValidated: v } }))} />
      <FieldRow label="How you will get there" htmlFor="crp-trajectory" hint="Optional. The main levers and the expected path to net zero.">
        <textarea id="crp-trajectory" rows={3} className={textareaCls} disabled={disabled} value={s.targets.trajectoryNote} onChange={(e) => update((p) => ({ ...p, targets: { ...p.targets, trajectoryNote: e.target.value } }))} />
      </FieldRow>
      <Checks checks={data.checks} section="targets" />
    </div>
  );

  const measures = (
    <div className="space-y-6">
      {ctx.initiatives.length && !disabled ? (
        <Note>
          You have {ctx.initiatives.length} reduction initiative{ctx.initiatives.length === 1 ? "" : "s"} under Targets.{" "}
          <button
            type="button"
            className="font-medium text-[#c2410c] underline"
            onClick={() =>
              update((p) => {
                const have = new Set([...p.measures.completed, ...p.measures.planned].map((m) => m.name.trim().toLowerCase()));
                const add = ctx.initiatives.filter((i) => !have.has(i.name.trim().toLowerCase()));
                const row = (i: (typeof add)[number]) => ({ id: rid(), name: i.name, year: "" as const, description: "", savingTco2e: i.expectedTonnes != null ? Number(i.expectedTonnes.toFixed(2)) : ("" as const) });
                return {
                  ...p,
                  measures: {
                    ...p.measures,
                    completed: [...p.measures.completed, ...add.filter((i) => i.status === "complete").map(row)],
                    planned: [...p.measures.planned, ...add.filter((i) => i.status !== "complete").map(row)],
                  },
                };
              })
            }
          >
            Copy them in
          </button>
        </Note>
      ) : null}
      <div>
        <p className="text-sm font-medium text-gray-900">Completed since the baseline</p>
        <p className="mb-3 text-xs text-gray-600">Measures already in place, with the year completed and the saving you estimate.</p>
        <MeasureRows idPrefix="done" yearLabel="Year completed" rows={s.measures.completed} disabled={disabled} onChange={(rows) => update((p) => ({ ...p, measures: { ...p.measures, completed: rows } }))} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">Planned, including during the contract</p>
        <p className="mb-3 text-xs text-gray-600">Measures you will implement, with the year you expect to.</p>
        <MeasureRows idPrefix="plan" yearLabel="Planned year" rows={s.measures.planned} disabled={disabled} onChange={(rows) => update((p) => ({ ...p, measures: { ...p.measures, planned: rows } }))} />
      </div>
      <FieldRow label="Further commitments" htmlFor="crp-future" hint="Optional. For example supplier engagement, fleet replacement or site energy policy.">
        <textarea id="crp-future" rows={3} className={textareaCls} disabled={disabled} value={s.measures.futureNote} onChange={(e) => update((p) => ({ ...p, measures: { ...p.measures, futureNote: e.target.value } }))} />
      </FieldRow>
      <Checks checks={data.checks} section="measures" />
    </div>
  );

  const secr = (
    <div className="space-y-4">
      <Note>
        Streamlined Energy and Carbon Reporting applies to quoted companies and to large unquoted companies and LLPs. Tick below to generate the SECR report with
        the plan, from the same published figures.
      </Note>
      <CheckRow id="crp-secr" label="Also generate the SECR report for this period" checked={s.secr.include} disabled={disabled} onChange={(v) => update((p) => ({ ...p, secr: { ...p.secr, include: v } }))} />
      <CheckRow id="crp-verify-line" label="Add a footer line to the plan: &quot;Figures calculated from records in MetricOra&quot;, linking to its verification page, so an evaluator can check the published copy" checked={s.organisation.showVerificationLine} disabled={disabled} onChange={(v) => update((p) => ({ ...p, organisation: { ...p.organisation, showVerificationLine: v } }))} />
      {s.secr.include ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Intensity denominator" htmlFor="crp-secr-den" hint="For example employee, £m turnover or tonne of output.">
              <input id="crp-secr-den" className={inputCls} disabled={disabled} value={s.secr.intensityDenominator} onChange={(e) => update((p) => ({ ...p, secr: { ...p.secr, intensityDenominator: e.target.value } }))} />
            </FieldRow>
            <FieldRow label={`Value for ${ctx.period.label}`} htmlFor="crp-secr-val" hint="For example 250 employees, or 36.5 for £36.5m turnover.">
              <input id="crp-secr-val" type="number" min={0} step="any" className={inputCls} disabled={disabled} value={s.secr.intensityValue} onChange={(e) => update((p) => ({ ...p, secr: { ...p.secr, intensityValue: e.target.value === "" ? "" : Number(e.target.value) } }))} />
            </FieldRow>
          </div>
          <FieldRow label="Principal energy efficiency measures in the year" htmlFor="crp-secr-eff" hint="One measure per line. SECR requires them, or a statement that there were none.">
            <textarea id="crp-secr-eff" rows={4} className={textareaCls} disabled={disabled} value={s.secr.efficiencyNarrative} onChange={(e) => update((p) => ({ ...p, secr: { ...p.secr, efficiencyNarrative: e.target.value } }))} />
          </FieldRow>
        </>
      ) : null}
      <Checks checks={data.checks} section="secr" />
    </div>
  );

  const declaration = (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">A director, or equivalent, signs the plan off. The printed declaration follows the Cabinet Office template.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <FieldRow label="Name *" htmlFor="crp-sig-name">
          <input id="crp-sig-name" className={inputCls} disabled={disabled} value={s.declaration.signatoryName} onChange={(e) => update((p) => ({ ...p, declaration: { ...p.declaration, signatoryName: e.target.value } }))} />
        </FieldRow>
        <FieldRow label="Job title *" htmlFor="crp-sig-title">
          <input id="crp-sig-title" className={inputCls} disabled={disabled} value={s.declaration.signatoryTitle} placeholder="Managing Director" onChange={(e) => update((p) => ({ ...p, declaration: { ...p.declaration, signatoryTitle: e.target.value } }))} />
        </FieldRow>
        <FieldRow label="Date signed *" htmlFor="crp-sig-date">
          <input id="crp-sig-date" type="date" className={inputCls} disabled={disabled} value={s.declaration.signedDate} onChange={(e) => update((p) => ({ ...p, declaration: { ...p.declaration, signedDate: e.target.value } }))} />
        </FieldRow>
      </div>
      <div className="rounded border border-gray-200 bg-white p-2">
        <CheckRow id="crp-board" label="This plan has been reviewed and signed off by the board of directors (or equivalent management body)." checked={s.declaration.boardApproved} disabled={disabled} onChange={(v) => update((p) => ({ ...p, declaration: { ...p.declaration, boardApproved: v } }))} />
        <CheckRow id="crp-method" label="Emissions are reported under the GHG Protocol Corporate Standard with the UK Government conversion factors, and the required Scope 3 categories under the reporting standard for Carbon Reduction Plans." checked={s.declaration.methodologyConfirmed} disabled={disabled} onChange={(v) => update((p) => ({ ...p, declaration: { ...p.declaration, methodologyConfirmed: v } }))} />
      </div>
      <Checks checks={data.checks} section="declaration" />
    </div>
  );

  async function generate() {
    if (!ctx.snapshot) return;
    await run("generate", async () => {
      const crp = await api<{ id: string }>(`${base}/reports`, {
        method: "POST",
        body: JSON.stringify({
          snapshotId: ctx.snapshot!.id,
          reportingPeriodId: ctx.period.id,
          type: "ppn_006_crp",
          options: { crpPlanId: planId, planVersion: data!.plan.updatedAt },
        }),
      });
      let secrId: string | undefined;
      if (s.secr.include) {
        const secrReport = await api<{ id: string }>(`${base}/reports`, {
          method: "POST",
          body: JSON.stringify({
            snapshotId: ctx.snapshot!.id,
            reportingPeriodId: ctx.period.id,
            type: "secr",
            options: {
              ...(s.secr.intensityDenominator ? { intensityDenominator: s.secr.intensityDenominator } : {}),
              ...(s.secr.intensityValue !== "" ? { intensityDenominatorValue: Number(s.secr.intensityValue) } : {}),
              efficiencyMeasures: s.secr.efficiencyNarrative
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            },
          }),
        });
        secrId = secrReport.id;
      }
      await api(`${base}/carbon-reduction-plans/${planId}`, { method: "PATCH", body: JSON.stringify({ lastReportId: crp.id }) });
      setGenerated({ crp: crp.id, secr: secrId });
    });
  }

  const review = (
    <div className="space-y-5">
      <Note tone={data.ready ? "ok" : "warn"}>
        {data.ready
          ? "Every required PPN 006 item is in place. Generate the plan, then publish it on your website."
          : `${passedRequired} of ${required.length} required items are in place. Open a section below to finish it.`}
      </Note>
      {SECTIONS.filter((x) => x.key !== "review").map((sec) => {
        const mine = data.checks.filter((c) => c.section === sec.key);
        if (!mine.length) return null;
        return (
          <div key={sec.key}>
            <button type="button" onClick={() => setActive(sec.key)} className="mb-1 text-sm font-medium text-gray-900 underline-offset-2 hover:underline">
              {sec.label}
            </button>
            <Checks checks={data.checks} section={sec.key as CrpSectionKey} />
          </div>
        );
      })}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!data.ready || !!busy || pending} onClick={generate} className="flex items-center gap-1 rounded bg-[#c2410c] px-4 py-2 text-sm font-medium text-white hover:bg-[#9a3412] disabled:opacity-50">
            {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Generate Carbon Reduction Plan{s.secr.include ? " and SECR report" : ""}
          </button>
          {pending ? <span className="text-xs text-gray-500">Saving your latest changes first…</span> : null}
        </div>
      ) : null}
      {generated || data.plan.lastReportId ? (
        <Note tone="ok">
          {generated ? "Generating now." : "A plan has been generated from this page before."} The PDF{generated?.secr ? "s appear" : " appears"} under{" "}
          <Link href={`/orgs/${orgId}/reports`} className="font-medium underline">
            Reports
          </Link>{" "}
          with its calculation trail. Changing the plan returns it to draft; generate again to update the PDF.
        </Note>
      ) : null}
    </div>
  );

  const bodies: Record<SectionKey, React.ReactNode> = {
    period,
    organisation,
    emissions,
    baseline,
    targets,
    measures,
    secr,
    declaration,
    review,
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      <SectionNav sections={nav} active={active} onSelect={setActive} open={navOpen} onClose={() => setNavOpen(false)} footer={`${passedRequired}/${required.length} required items`} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 py-2.5">
          <button className="flex h-8 w-8 items-center justify-center rounded hover:bg-gray-100 md:hidden" onClick={() => setNavOpen(true)} aria-label="Open sections">
            <Menu className="h-4 w-4 text-gray-500" />
          </button>
          <Link href={`/orgs/${orgId}/carbon-reduction-plan`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
            <ChevronLeft className="h-3.5 w-3.5" /> Carbon Reduction Plans
          </Link>
          <span className="text-gray-300">/</span>
          <span className="truncate text-sm font-medium text-gray-800">{ctx.period.label}</span>
          <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${data.plan.status === "generated" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
            {data.plan.status === "generated" ? "Generated" : "Draft"}
          </span>
          <div className="ml-auto flex items-center gap-2" aria-live="polite">
            {saveState === "saving" ? (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Save className="h-3 w-3 animate-pulse" /> Saving…
              </span>
            ) : null}
            {saveState === "saved" ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Saved
              </span>
            ) : null}
            {saveState === "error" ? (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3 w-3" /> Not saved
              </span>
            ) : null}
          </div>
        </div>
        {error ? (
          <div role="alert" className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {error}
          </div>
        ) : null}
        {!canEdit ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">You can view this plan. Editors and administrators can change it.</div>
        ) : null}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            <h2 className="mb-5 text-base font-semibold text-gray-900">{SECTIONS.find((x) => x.key === active)?.label}</h2>
            {bodies[active]}
          </div>
        </div>
        <SectionPager sections={nav} active={active} onSelect={setActive} />
      </div>
    </div>
  );
}

function BaselineSection({
  ctx,
  s,
  disabled,
  canSetBaseYear,
  periods,
  busy,
  onRun,
  base,
  update,
  checks,
}: {
  ctx: Context;
  s: CrpSections;
  disabled: boolean;
  canSetBaseYear: boolean;
  periods: { id: string; label: string }[];
  busy: string | null;
  onRun: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  base: string;
  update: (fn: (s: CrpSections) => CrpSections) => void;
  checks: CrpCheck[];
}) {
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const by = ctx.baseYear;
  const current = ctx.snapshot?.totals;
  const pct = (from: number | null, to: number | undefined) =>
    from != null && from > 0 && to != null ? `${(((to - from) / from) * 100).toFixed(1)}%` : "n/a";
  return (
    <div className="space-y-5">
      {by ? (
        <>
          <Note tone={by.status === "active" ? "ok" : "warn"}>
            Base year <strong>{by.label}</strong> ({by.periodLabel}) is {by.status === "active" ? "active" : "a draft"}.{" "}
            {by.status !== "active" ? "Make it active so the plan can report against it." : null}
          </Note>
          <div className="overflow-x-auto rounded border border-gray-200 bg-white">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                  <th className="px-3 py-2 font-medium">Scope</th>
                  <th className="px-3 py-2 text-right font-medium">Baseline</th>
                  <th className="px-3 py-2 text-right font-medium">{ctx.period.label}</th>
                  <th className="px-3 py-2 text-right font-medium">Change</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {(
                  [
                    ["Scope 1", by.s1, current?.s1],
                    ["Scope 2", by.s2, current?.s2],
                    ["Scope 3", by.s3, current?.s3],
                    ["Total", by.total, current?.total],
                  ] as const
                ).map(([label, b, c]) => (
                  <tr key={label} className="border-b border-gray-50 last:border-0">
                    <td className="px-3 py-2">{label}</td>
                    <td className="px-3 py-2 text-right">{fmtT(b)}</td>
                    <td className="px-3 py-2 text-right">{c != null ? fmtT(c) : "Not published"}</td>
                    <td className="px-3 py-2 text-right">{pct(b, c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {by.status !== "active" && canSetBaseYear ? (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => onRun("activate", () => api(`${base}/base-years/${by.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) }))}
              className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              Make {by.label} the active base year
            </button>
          ) : null}
        </>
      ) : (
        <Note tone="warn">No base year yet. Choose the earliest year with complete, published Scope 1 and 2 data.</Note>
      )}
      {canSetBaseYear ? (
        <div className="rounded border border-gray-200 bg-white p-3">
          <p className="text-sm font-medium text-gray-900">{by ? "Set a different base year" : "Set the base year"}</p>
          <p className="mb-3 text-xs text-gray-600">Its totals are frozen from the period&apos;s calculations when you set it, and kept beside any later recalculation.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px]">
              <FieldRow label="Baseline period" htmlFor="crp-by-period">
                <select id="crp-by-period" className={inputCls} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </FieldRow>
            </div>
            <button
              type="button"
              disabled={!!busy || !periodId}
              onClick={() =>
                onRun("baseyear", async () => {
                  const label = `${periods.find((p) => p.id === periodId)?.label ?? "Baseline"} base year`;
                  const created = await api<{ id: string }>(`${base}/base-years`, {
                    method: "POST",
                    body: JSON.stringify({ reportingPeriodId: periodId, label, rationale: s.baseline.rationale || undefined }),
                  });
                  await api(`${base}/base-years/${created.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
                })
              }
              className="h-9 rounded border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === "baseyear" ? "Setting…" : "Set as active base year"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-600">Only administrators and sustainability directors can set the base year.</p>
      )}
      <FieldRow label="Why this baseline year was chosen *" htmlFor="crp-by-why" hint="For example: the first year with complete metered energy and fuel records for all sites.">
        <textarea id="crp-by-why" rows={3} className={textareaCls} disabled={disabled} value={s.baseline.rationale} onChange={(e) => update((p) => ({ ...p, baseline: { ...p.baseline, rationale: e.target.value } }))} />
      </FieldRow>
      <FieldRow label="Additional details" htmlFor="crp-by-more" hint="Optional. Structural changes since the baseline, recalculations, or data limitations.">
        <textarea id="crp-by-more" rows={3} className={textareaCls} disabled={disabled} value={s.baseline.additionalDetails} onChange={(e) => update((p) => ({ ...p, baseline: { ...p.baseline, additionalDetails: e.target.value } }))} />
      </FieldRow>
      <Checks checks={checks} section="baseline" />
    </div>
  );
}
