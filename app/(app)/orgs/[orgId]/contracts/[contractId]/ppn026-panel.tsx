"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { inputCls } from "@/components/structured-forms/ms-fields";
import type { CriterionSummary, Ppn026Check } from "@/lib/social-value/ppn026";
import { FormActions, FormField, FormSection } from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";

type Props = {
  orgId: string;
  contractId: string;
  canEdit: boolean;
  installed: boolean;
  version: string | null;
  minimumWeighting: number | null;
  criteria: CriterionSummary[];
  checks: Ppn026Check[];
  criterionIds: Record<string, string>;
  frameworkId: string | null;
  unassigned: number;
};

const NETWORK = "Couldn't reach the server. Check your connection and try again.";

async function send(url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const d = (await res.json().catch(() => ({}))) as { message?: string };
    return d.message ?? "Could not save.";
  } catch {
    return NETWORK;
  }
}

const fmt = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

export function Ppn026Panel(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [kpi, setKpi] = useState({ criterion: p.criteria[0]?.code ?? "jobs", title: "", target: "", unit: "" });
  const [entry, setEntry] = useState({ date: new Date().toISOString().slice(0, 10), quantity: "", evidence: "", note: "" });
  const [file, setFile] = useState<File | null>(null);

  async function run(key: string, fn: () => Promise<string | null>, done?: () => void) {
    setBusy(key);
    setError(null);
    const err = await fn();
    setBusy(null);
    if (err) setError(err);
    else {
      done?.();
      router.refresh();
    }
  }

  if (!p.installed) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[#374151] max-w-[65ch]">
          From 1 January 2027, central government buyers score social value on jobs and skills for contracts of £1m or more (PPN 026). Add the model to
          track the KPIs you commit to on this contract and the evidence of delivery.
        </p>
        {p.canEdit ? (
          <div>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("install", () => send(`/api/orgs/${p.orgId}/sv/frameworks/ppn-026`, {}))}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#111827] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1F2937] disabled:opacity-50"
            >
              {busy === "install" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Add the PPN 026 Social Value Model
            </button>
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  const unitFor = (id: string) => p.criteria.flatMap((c) => c.kpis).find((k) => k.id === id)?.unit ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#6B7280]">
        <span>Model version: {p.version}</span>
        <span>
          Minimum social value weighting for this contract value:{" "}
          {p.minimumWeighting != null ? `${p.minimumWeighting}%` : "not in scope (under £1m or no value set)"}
        </span>
      </div>

      <ul className="grid gap-1.5">
        {p.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm">
            {c.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
            <span>
              <span className="text-[#111827]">{c.label}</span>
              {!c.passed ? <span className="block text-xs text-[#6B7280]">{c.fix}</span> : null}
            </span>
          </li>
        ))}
      </ul>

      {["good-jobs", "skills"].map((outcome) => {
        const rows = p.criteria.filter((c) => c.outcomeCode === outcome);
        return (
          <section key={outcome} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-[#111827]">{rows[0]?.outcomeName}</h3>
            <div className="rounded-[14px] border border-[#E5E7EB] overflow-x-auto">
              <table className="w-full table-fixed text-sm min-w-[560px]">
                <thead>
                  <tr className="bg-[#f9fafb] text-left text-xs text-[#374151]">
                    <th className="py-2.5 pl-4 font-normal">Award criterion and KPI</th>
                    <th className="py-2.5 font-normal text-right w-[110px]">Target</th>
                    <th className="py-2.5 font-normal text-right w-[110px]">Delivered</th>
                    <th className="py-2.5 font-normal text-right w-[80px]">Evidence</th>
                    <th className="py-2.5 pr-4 w-[120px]" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <Fragment key={c.code}>
                      <tr className="border-t border-[#F3F4F6]">
                        <td colSpan={5} className="py-2 pl-4 text-xs font-medium text-[#374151]">
                          {c.name}
                          {c.kpis.length === 0 ? <span className="ml-2 font-normal text-[#9CA3AF]">No KPI</span> : null}
                        </td>
                      </tr>
                      {c.kpis.map((k) => (
                        <tr key={k.id} className="border-t border-[#F3F4F6]">
                          <td className="py-2 pl-8 text-[#111827]">
                            {k.title}
                            {k.pendingEntries > 0 ? (
                              <Link href={`/orgs/${p.orgId}/social-value/activities`} className="ml-2 text-xs text-[#c2410c] underline">
                                {k.pendingEntries} awaiting review
                              </Link>
                            ) : null}
                          </td>
                          <td className="py-2 text-right tabular-nums">{k.target != null ? `${fmt(k.target)} ${k.unit ?? ""}` : "-"}</td>
                          <td className="py-2 text-right tabular-nums">
                            {fmt(k.delivered)}
                            {k.progressPct != null ? <span className="ml-1 text-xs text-[#6B7280]">{k.progressPct}%</span> : null}
                          </td>
                          <td className="py-2 text-right tabular-nums text-xs text-[#374151]">
                            {k.entriesWithEvidence}/{k.approvedEntries}
                          </td>
                          <td className="py-2 pr-4 text-right">
                            {p.canEdit ? (
                              <button type="button" onClick={() => setLogFor(logFor === k.id ? null : k.id)} className="text-xs text-[#111827] underline underline-offset-2">
                                Log delivery
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      {p.unassigned > 0 ? (
        <p className="text-xs text-[#6B7280]">
          {p.unassigned} KPI{p.unassigned === 1 ? " is" : "s are"} not linked to a criterion. Link them from Social value, Commitments.
        </p>
      ) : null}

      {logFor ? (
        <form
          className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const k = p.criteria.flatMap((c) => c.kpis).find((x) => x.id === logFor);
            void run(
              "log",
              async () => {
                let evidenceUrl = entry.evidence;
                if (file) {
                  try {
                    const body = new FormData();
                    body.append("file", file);
                    const up = await fetch(`/api/orgs/${p.orgId}/sv/activities/evidence`, { method: "POST", body });
                    const d = (await up.json().catch(() => ({}))) as { url?: string; message?: string };
                    if (!up.ok || !d.url) return d.message ?? "Couldn't upload the evidence file.";
                    evidenceUrl = d.url;
                  } catch {
                    return NETWORK;
                  }
                }
                return send(`/api/orgs/${p.orgId}/sv/activities`, {
                  commitmentId: logFor,
                  title: k?.title ?? "Delivery",
                  description: entry.note || undefined,
                  activityDate: entry.date,
                  quantityValue: Number(entry.quantity),
                  quantityUnit: unitFor(logFor) || undefined,
                  evidenceUrls: evidenceUrl ? [evidenceUrl] : undefined,
                });
              },
              () => {
                setFile(null);
                setLogFor(null);
                setEntry({ date: new Date().toISOString().slice(0, 10), quantity: "", evidence: "", note: "" });
              },
            );
          }}
        >
          <FormSection title={`Log delivery: ${p.criteria.flatMap((c) => c.kpis).find((x) => x.id === logFor)?.title ?? ""}`} description="Delivery is reviewed before it counts. Do not include personal details in notes or files." cols={3}>
            <FormField label="Date" htmlFor="ppn026-date">
              <input id="ppn026-date" type="date" required className={inputCls} value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} />
            </FormField>
            <FormField label={`Quantity${unitFor(logFor) ? ` (${unitFor(logFor)})` : ""}`} htmlFor="ppn026-qty">
              <input id="ppn026-qty" type="number" min="0" step="any" required className={inputCls} value={entry.quantity} onChange={(e) => setEntry({ ...entry, quantity: e.target.value })} />
            </FormField>
            <FormField label="Evidence" htmlFor="ppn026-file" span={3} optional hint="Upload a file or paste a link to the payroll extract, training record or timesheet">
              <input id="ppn026-file" type="file" accept="application/pdf,image/*,.csv,.xlsx,.docx" className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-md file:border file:border-[#D1D5DB] file:bg-white file:px-3 file:py-1.5 file:text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <input id="ppn026-evidence" type="url" aria-label="Or a link to the evidence" placeholder="https://" className={inputCls} value={entry.evidence} onChange={(e) => setEntry({ ...entry, evidence: e.target.value })} />
            </FormField>
            <FormField label="Note" htmlFor="ppn026-note" span={3} optional>
              <input id="ppn026-note" className={inputCls} value={entry.note} onChange={(e) => setEntry({ ...entry, note: e.target.value })} />
            </FormField>
          </FormSection>
          <FormActions>
            <Button type="button" size="sm" variant="outline" onClick={() => setLogFor(null)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!!busy}>{busy === "log" ? "Saving..." : "Submit for review"}</Button>
          </FormActions>
        </form>
      ) : null}

      {p.canEdit ? (
        adding ? (
          <form
            className="space-y-6 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                "kpi",
                () =>
                  send(`/api/orgs/${p.orgId}/sv/commitments`, {
                    contractId: p.contractId,
                    frameworkId: p.frameworkId,
                    outcomeId: p.criterionIds[kpi.criterion],
                    title: kpi.title,
                    targetValue: kpi.target ? Number(kpi.target) : undefined,
                    targetUnit: kpi.unit || undefined,
                    status: "active",
                  }),
                () => {
                  setAdding(false);
                  setKpi({ ...kpi, title: "", target: "", unit: "" });
                },
              );
            }}
          >
            <FormSection title="Add a KPI" description="The measure you committed to in the bid, under one of the award criteria." cols={4}>
              <FormField label="Award criterion" htmlFor="ppn026-criterion" span={2}>
                <select id="ppn026-criterion" className={inputCls} value={kpi.criterion} onChange={(e) => setKpi({ ...kpi, criterion: e.target.value })}>
                  {p.criteria.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.outcomeName}: {c.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="KPI, as committed in the bid" htmlFor="ppn026-title" span={2}>
                <input id="ppn026-title" required maxLength={300} placeholder="For example: apprenticeship starts on the contract" className={inputCls} value={kpi.title} onChange={(e) => setKpi({ ...kpi, title: e.target.value })} />
              </FormField>
              <FormField label="Target" htmlFor="ppn026-target" optional>
                <input id="ppn026-target" type="number" min="0" step="any" className={inputCls} value={kpi.target} onChange={(e) => setKpi({ ...kpi, target: e.target.value })} />
              </FormField>
              <FormField label="Unit" htmlFor="ppn026-unit" optional>
                <input id="ppn026-unit" maxLength={50} placeholder="starts, hours, people" className={inputCls} value={kpi.unit} onChange={(e) => setKpi({ ...kpi, unit: e.target.value })} />
              </FormField>
            </FormSection>
            <FormActions>
              <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={!!busy}>{busy === "kpi" ? "Saving..." : "Add KPI"}</Button>
            </FormActions>
          </form>
        ) : (
          <div>
            <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 rounded-md border border-[#D1D5DB] px-3 py-1.5 text-sm text-[#111827] hover:bg-[#F9FAFB]">
              <Plus className="h-3.5 w-3.5" /> Add KPI
            </button>
          </div>
        )
      ) : null}

      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
