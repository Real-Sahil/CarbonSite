"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronRight, FileText, Loader2 } from "lucide-react";
import { EVIDENCE_TIER_LABEL, EVIDENCE_TIER_ORDER, type EvidenceTier, type TierSplit } from "@/lib/data-quality/evidence-tier";

type Category = { id: string; code: string; name: string; scope: number; kgCo2e: number; recordCount: number };
type Item = {
  calculationId: string;
  kgCo2e: number;
  formula: string;
  factorValue: number | null;
  factorSource: string;
  selectionReason: string | null;
  normalized: string;
  warnings: string[];
  record: {
    id: string;
    amount: number;
    unit: string;
    activityDate: string;
    description: string | null;
    facility: string | null;
    source: string;
    tier: EvidenceTier;
    tierReasons: string[];
    evidence: { id: string; filename: string; mimeType: string }[];
  };
};
type Lineage = {
  snapshot: { id: string; version: number; publishedAt: string; periodLabel: string; factorLibrary: string | null; methodology: string | null } | null;
  tiers: TierSplit | null;
  categories: Category[];
  records: { categoryId: string; nextCursor: string | null; items: Item[] } | null;
};

const t = (kg: number) => (kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 });
const TIER_BAR: Record<EvidenceTier, string> = { verified: "bg-emerald-500", partial: "bg-amber-400", estimated: "bg-slate-300" };
const TIER_CHIP: Record<EvidenceTier, string> = {
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  estimated: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function LineagePage() {
  const { orgId } = useParams<{ orgId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const snapshotId = search.get("snapshotId");
  const categoryId = search.get("categoryId");

  const [data, setData] = useState<Lineage | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = useCallback(
    (c?: string | null) => {
      const q = new URLSearchParams();
      if (snapshotId) q.set("snapshotId", snapshotId);
      if (categoryId) q.set("categoryId", categoryId);
      if (c) q.set("cursor", c);
      return `/api/orgs/${orgId}/lineage?${q}`;
    },
    [orgId, snapshotId, categoryId],
  );

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url());
        if (!res.ok) throw new Error();
        const d = (await res.json()) as Lineage;
        if (!live) return;
        setData(d);
        setItems(d.records?.items ?? []);
        setCursor(d.records?.nextCursor ?? null);
      } catch {
        if (live) setError("Couldn't load the figures. Check your connection and try again.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [url]);

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    try {
      const res = await fetch(url(cursor));
      if (res.ok) {
        const d = (await res.json()) as Lineage;
        setItems((prev) => [...prev, ...(d.records?.items ?? [])]);
        setCursor(d.records?.nextCursor ?? null);
      }
    } catch {
      // Keep what is shown; the button stays for another try.
    } finally {
      setMore(false);
    }
  }

  const go = (cat: string | null) => {
    const q = new URLSearchParams();
    if (snapshotId) q.set("snapshotId", snapshotId);
    if (cat) q.set("categoryId", cat);
    router.push(`/orgs/${orgId}/lineage${q.size ? `?${q}` : ""}`);
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#6B7280]" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-2 px-6 text-center">
        <AlertCircle className="h-6 w-6 text-red-600" />
        <p className="text-sm text-[#374151]">{error ?? "Couldn't load the figures."}</p>
      </div>
    );
  }
  if (!data.snapshot) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-semibold text-[#111827]">Trace a figure</h1>
        <p className="mt-2 text-sm text-[#374151]">Nothing is published yet. Calculate a period and publish it, then every figure can be traced here to its source.</p>
      </div>
    );
  }

  const s = data.snapshot;
  const selected = data.categories.find((c) => c.id === categoryId) ?? null;
  const totalKg = data.categories.reduce((a, c) => a + c.kgCo2e, 0);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-8 sm:px-8">
      <header>
        <nav className="mb-2 flex items-center gap-1 text-xs text-[#6B7280]">
          <button type="button" onClick={() => go(null)} className="hover:underline">
            {s.periodLabel}, snapshot v{s.version}
          </button>
          {selected ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-[#111827]">{selected.name}</span>
            </>
          ) : null}
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Trace a figure</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-[#374151]">
          Every published figure, from the category total down to the record, the factor, the formula and the ticket or invoice behind it.
          {s.factorLibrary ? ` Factors: ${s.factorLibrary}.` : ""}
          {s.methodology ? ` Method: ${s.methodology}.` : ""}
        </p>
        <a
          href={`/api/orgs/${orgId}/snapshots/${s.id}/assurance-pack`}
          className="mt-2 inline-block text-sm font-medium text-[#111827] underline underline-offset-2"
          title="Admins, reviewers and auditors: calculations, factors, evidence files and the audit trail in one ZIP"
        >
          Download assurance pack (ZIP)
        </a>
      </header>

      {data.tiers ? (
        <section aria-labelledby="tiers" className="flex flex-col gap-3">
          <h2 id="tiers" className="text-sm font-semibold text-[#111827]">Evidence behind the headline total</h2>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[#F3F4F6]">
            {EVIDENCE_TIER_ORDER.map((k) => (
              <div key={k} className={TIER_BAR[k]} style={{ width: `${data.tiers![k].percent}%` }} />
            ))}
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {EVIDENCE_TIER_ORDER.map((k) => (
              <div key={k} className="flex items-baseline gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${TIER_BAR[k]}`} aria-hidden />
                <dt className="text-sm text-[#374151]">{EVIDENCE_TIER_LABEL[k]}</dt>
                <dd className="ml-auto text-sm tabular-nums text-[#111827]">
                  {data.tiers![k].percent.toFixed(0)}%
                  <span className="ml-1 text-xs text-[#6B7280]">{data.tiers![k].records.toLocaleString("en-GB")} records</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-[#6B7280]">
            Verified: metered, invoiced or supplier data with evidence attached, approved in review. Partially verified: one of those is missing. Estimated: estimates and proxies, or records with neither evidence nor approval.
          </p>
        </section>
      ) : null}

      {!selected ? (
        <section aria-labelledby="cats" className="flex flex-col gap-3">
          <h2 id="cats" className="text-sm font-semibold text-[#111827]">Category totals</h2>
          <div className="overflow-x-auto rounded-[14px] border border-[#E5E7EB]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F9FAFB] text-left text-xs text-[#374151]">
                  <th className="py-2.5 pl-4 font-normal">Category</th>
                  <th className="py-2.5 font-normal text-right">tCO₂e</th>
                  <th className="py-2.5 font-normal text-right">Share</th>
                  <th className="py-2.5 pr-4 font-normal text-right">Records</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((c) => (
                  <tr key={c.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                    <td className="py-2.5 pl-4">
                      <button type="button" onClick={() => go(c.id)} className="text-left text-[#111827] underline-offset-2 hover:underline">
                        <span className="mr-2 text-xs text-[#6B7280]">Scope {c.scope}</span>
                        {c.name}
                      </button>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{t(c.kgCo2e)}</td>
                    <td className="py-2.5 text-right tabular-nums text-[#6B7280]">{totalKg > 0 ? `${((c.kgCo2e / totalKg) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{c.recordCount.toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section aria-labelledby="recs" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="recs" className="text-sm font-semibold text-[#111827]">
              {selected.name}: {t(selected.kgCo2e)} tCO₂e from {selected.recordCount.toLocaleString("en-GB")} records, largest first
            </h2>
            <button type="button" onClick={() => go(null)} className="text-xs text-[#374151] underline underline-offset-2">
              All categories
            </button>
          </div>
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" /> : null}
          <ol className="flex flex-col gap-3">
            {items.map((it) => (
              <li key={it.calculationId} className="rounded-[14px] border border-[#E5E7EB] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">{it.record.description ?? "Activity record"}</p>
                    <p className="text-xs text-[#6B7280]">
                      {new Date(it.record.activityDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      {it.record.facility ? `, ${it.record.facility}` : ""}. {it.record.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span title={it.record.tierReasons.join(". ") || undefined} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${TIER_CHIP[it.record.tier]}`}>
                      {EVIDENCE_TIER_LABEL[it.record.tier]}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[#111827]">{t(it.kgCo2e)} t</span>
                  </div>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div className="flex gap-2"><dt className="text-[#6B7280]">Activity</dt><dd className="tabular-nums">{it.record.amount.toLocaleString("en-GB")} {it.record.unit} ({it.normalized})</dd></div>
                  <div className="flex gap-2"><dt className="text-[#6B7280]">Factor</dt><dd>{it.factorValue != null ? it.factorValue.toLocaleString("en-GB", { maximumSignificantDigits: 6 }) : "-"} from {it.factorSource}</dd></div>
                  <div className="flex gap-2 sm:col-span-2"><dt className="text-[#6B7280]">Formula</dt><dd className="font-mono break-all">{it.formula}</dd></div>
                  {it.selectionReason ? <div className="flex gap-2 sm:col-span-2"><dt className="text-[#6B7280]">Why this factor</dt><dd>{it.selectionReason}</dd></div> : null}
                  {it.warnings.length ? <div className="flex gap-2 sm:col-span-2"><dt className="text-amber-700">Warnings</dt><dd className="text-amber-800">{it.warnings.join(" ")}</dd></div> : null}
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {it.record.evidence.length ? (
                    it.record.evidence.map((e) => (
                      <a
                        key={e.id}
                        href={`/api/orgs/${orgId}/evidence/${e.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] px-2 py-1 text-xs text-[#111827] hover:bg-[#F9FAFB]"
                      >
                        <FileText className="h-3.5 w-3.5" /> {e.filename}
                      </a>
                    ))
                  ) : (
                    <span className="text-xs text-[#6B7280]">No evidence file attached.</span>
                  )}
                  <Link href={`/orgs/${orgId}/records/${it.record.id}`} className="ml-auto text-xs text-[#374151] underline underline-offset-2">
                    Open record
                  </Link>
                </div>
              </li>
            ))}
          </ol>
          {cursor ? (
            <div>
              <button type="button" disabled={more} onClick={loadMore} className="rounded-md border border-[#D1D5DB] px-3 py-1.5 text-sm text-[#111827] disabled:opacity-50">
                {more ? "Loading..." : "Show more"}
              </button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
