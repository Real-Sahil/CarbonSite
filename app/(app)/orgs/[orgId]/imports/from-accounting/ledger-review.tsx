"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FormError, fieldClass } from "@/components/forms/form-kit";
import { useOrgMoney } from "@/components/org/org-locale";

type Bucket = "spend" | "needs_quantity" | "not_emissions" | "review";
interface Line {
  id: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  supplier: string;
  description: string;
  amount: number;
  suggestion: { bucket: Bucket; categoryCode: string | null; industryCode: string | null; confidence: number; reason: string };
}

const LOW = 0.7;
const CATEGORIES: Array<[string, string]> = [
  ["s3-purchased-goods", "Purchased goods and services"],
  ["s3-capital-goods", "Capital goods"],
  ["s3-upstream-transport", "Upstream transport"],
  ["s3-business-travel", "Business travel"],
  ["s3-upstream-leased", "Upstream leased assets"],
  ["s3-downstream-transport", "Downstream transport"],
];

export function LedgerReview({ orgId, periods }: { orgId: string; periods: Array<{ id: string; label: string }> }) {
  const money = useOrgMoney();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [currency, setCurrency] = useState("GBP");
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [category, setCategory] = useState<Record<string, string>>({});
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/orgs/${orgId}/integrations/xero/suggestions`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.message ?? j.error ?? "Could not load the lines.");
        setLines(j.lines);
        setCurrency(j.currency);
        const p: Record<string, boolean> = {};
        const c: Record<string, string> = {};
        for (const l of j.lines as Line[]) {
          if (l.suggestion.bucket === "spend" && l.suggestion.categoryCode) {
            c[l.id] = l.suggestion.categoryCode;
            p[l.id] = l.suggestion.confidence >= LOW; // only the confident ones start ticked
          }
        }
        setPicked(p);
        setCategory(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load the lines."));
  }, [orgId]);

  const groups = useMemo(() => {
    const g: Record<Bucket, Line[]> = { spend: [], review: [], needs_quantity: [], not_emissions: [] };
    for (const l of lines ?? []) g[l.suggestion.bucket].push(l);
    return g;
  }, [lines]);

  const chosen = Object.keys(picked).filter((id) => picked[id] && category[id]);

  async function stage() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        reportingPeriodId: periodId,
        lines: chosen.map((id) => {
          const l = lines!.find((x) => x.id === id)!;
          return { id, categoryCode: category[id], industryCode: category[id] === l.suggestion.categoryCode ? l.suggestion.industryCode : null };
        }),
      };
      const r = await fetch(`/api/orgs/${orgId}/integrations/xero/suggestions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message ?? "Staging failed.");
      setDone(`${chosen.length} lines sent to Imports for review.`);
      setLines((prev) => (prev ?? []).filter((l) => !chosen.includes(l.id)));
      setPicked({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Staging failed.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lines) return <FormError>{error}</FormError>;
  if (!lines) return <p className="text-sm text-[#6B7280]">Loading lines…</p>;
  if (lines.length === 0)
    return (
      <p className="text-sm text-[#6B7280]">
        No synced invoice lines are waiting. Connect Xero under <Link className="underline underline-offset-4" href={`/orgs/${orgId}/settings/integrations`}>Settings, Integrations</Link> and run a sync.
      </p>
    );

  const row = (l: Line, selectable: boolean) => (
    <tr key={l.id} className="border-b border-[#E5E7EB] last:border-0 align-top">
      {selectable ? (
        <td className="w-10 px-3 py-3">
          <input
            type="checkbox"
            aria-label={`Include ${l.supplier} ${l.invoiceNumber}`}
            checked={!!picked[l.id]}
            disabled={!category[l.id]}
            onChange={(e) => setPicked((p) => ({ ...p, [l.id]: e.target.checked }))}
          />
        </td>
      ) : null}
      <td className="px-3 py-3 text-sm">
        <div className="font-medium text-[#111827]">{l.supplier}</div>
        <div className="text-xs text-[#6B7280]">{l.description || "No description"} · {l.invoiceNumber}{l.invoiceDate ? ` · ${l.invoiceDate}` : ""}</div>
      </td>
      <td className="px-3 py-3 text-right text-sm tabular-nums">{money.format(l.amount, { currency })}</td>
      <td className="px-3 py-3 text-sm">
        {selectable ? (
          <>
            <select
              aria-label={`Category for ${l.supplier} ${l.invoiceNumber}`}
              className={fieldClass}
              value={category[l.id] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setCategory((c) => ({ ...c, [l.id]: v }));
                setPicked((p) => ({ ...p, [l.id]: !!v }));
              }}
            >
              <option value="">Leave out</option>
              {CATEGORIES.map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[#6B7280]">{l.suggestion.reason}{l.suggestion.confidence > 0 && l.suggestion.confidence < LOW ? " (check this)" : ""}</p>
          </>
        ) : (
          <p className="text-xs text-[#6B7280]">{l.suggestion.reason}</p>
        )}
      </td>
    </tr>
  );

  const table = (items: Line[], selectable: boolean) => (
    <div className="overflow-x-auto rounded-[12px] border border-[#E5E7EB] bg-white">
      <table className="w-full text-left">
        <tbody>{items.map((l) => row(l, selectable))}</tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {done ? (
        <p role="status" className="rounded-[8px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {done} <Link className="underline underline-offset-4" href={`/orgs/${orgId}/imports`}>Open Imports</Link>
        </p>
      ) : null}

      <section aria-labelledby="spend-h" className="flex flex-col gap-3">
        <h2 id="spend-h" className="text-base font-semibold text-[#111827]">Ready to confirm ({groups.spend.length + groups.review.length})</h2>
        <p className="text-xs text-[#6B7280]">
          Priced on spend in {currency} (Xero line amounts; the invoice currency is not recorded, so check any foreign-currency invoices). Lines the rules were unsure of are not ticked.
        </p>
        {groups.spend.length + groups.review.length > 0 ? table([...groups.spend, ...groups.review], true) : <p className="text-sm text-[#6B7280]">None.</p>}
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-[#6B7280]">Reporting period</span>
            <select className={fieldClass} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={stage} disabled={busy || chosen.length === 0 || !periodId}>
            {busy ? "Sending…" : `Send ${chosen.length} to Imports`}
          </Button>
        </div>
        {error ? <FormError>{error}</FormError> : null}
      </section>

      {groups.needs_quantity.length > 0 ? (
        <section aria-labelledby="qty-h" className="flex flex-col gap-3">
          <h2 id="qty-h" className="text-base font-semibold text-[#111827]">Add from the bill ({groups.needs_quantity.length})</h2>
          <p className="text-xs text-[#6B7280]">
            Fuel, energy and waste: the quantity on the bill gives a better figure than the amount paid. Use <Link className="underline underline-offset-4" href={`/orgs/${orgId}/records`}>Add from a bill</Link> or forward the bill to your bill inbox.
          </p>
          {table(groups.needs_quantity, false)}
        </section>
      ) : null}

      {groups.not_emissions.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-[#111827]">Left out: tax, pay and finance ({groups.not_emissions.length})</summary>
          <div className="mt-3">{table(groups.not_emissions, false)}</div>
        </details>
      ) : null}
    </div>
  );
}
