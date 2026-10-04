"use client";

import Link from "next/link";
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";

type Detail = {
  sourceDescription: string | null;
  supplierName: string | null;
  amount: number | string;
  unit: string;
  reviewStatus: string;
  evidenceStatus: string;
  emissionCategory: { scope: number | string; name: string };
  reportingPeriod: { label: string };
  facility: { name: string } | null;
  calculations: {
    id: string;
    totalCo2e: number | string;
    formula: string;
    selectionReason: string | null;
    factorLibraryVersion: string;
    warnings: unknown;
    calculationRun?: { factorLibrary?: { name: string; version: string } };
  }[];
  evidence: { evidenceFile: { id: string; filename: string } }[];
};

/**
 * A side panel with the figures behind one record: what it says, the latest
 * calculation with its formula and factor, and the evidence attached. It reads
 * the same org-scoped record API as the record page and links to it for edits.
 */
export function RecordPanel({ orgId, recordId, label }: { orgId: string; recordId: string; label: string }) {
  const [open, setOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/orgs/${orgId}/activity-records/${recordId}`)
      .then(async (r) => (r.ok ? ((await r.json()) as Detail) : Promise.reject(new Error("Could not load the record."))))
      .then((d) => !cancelled && setDetail(d))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [open, orgId, recordId]);

  const calc = detail?.calculations[0];
  const warnings = Array.isArray(calc?.warnings) ? (calc!.warnings as unknown[]).map(String) : [];
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`Details: ${label}`}>Details</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content className="fixed right-0 top-0 z-50 flex h-full w-[min(440px,100vw)] flex-col gap-4 overflow-auto border-l border-[#E5E7EB] bg-white p-6 shadow-xl">
          <Dialog.Title className="text-base font-medium text-[#111827]">{label}</Dialog.Title>
          <Dialog.Description className="text-xs text-[#6B7280]">The figures behind this record. Open it in full to edit or review.</Dialog.Description>
          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {!detail && !error ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
          {detail ? (
            <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-[#6B7280]">Category</dt><dd>Scope {detail.emissionCategory.scope}: {detail.emissionCategory.name}</dd>
              <dt className="text-[#6B7280]">Amount</dt><dd className="tabular-nums">{Number(detail.amount).toLocaleString("en-GB")} {detail.unit}</dd>
              <dt className="text-[#6B7280]">Period</dt><dd>{detail.reportingPeriod.label}</dd>
              <dt className="text-[#6B7280]">Site</dt><dd>{detail.facility?.name ?? "Not assigned"}</dd>
              <dt className="text-[#6B7280]">Supplier</dt><dd>{detail.supplierName ?? "Not recorded"}</dd>
              <dt className="text-[#6B7280]">Review</dt><dd>{detail.reviewStatus.replace("_", " ")}</dd>
              <dt className="text-[#6B7280]">Evidence</dt>
              <dd>
                {detail.evidence.length === 0 ? "None attached" : detail.evidence.map((e) => e.evidenceFile.filename).join(", ")}
              </dd>
            </dl>
          ) : null}
          {detail ? (
            <section className="rounded-[10px] border border-[#E5E7EB] p-3 text-sm">
              <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6B7280]">Latest calculation</h3>
              {calc ? (
                <>
                  <p className="tabular-nums text-[#111827]">{(Number(calc.totalCo2e) / 1000).toLocaleString("en-GB", { maximumFractionDigits: 3 })} tCO₂e</p>
                  <p className="mt-1 text-xs text-[#374151]">{calc.formula}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">
                    Factor library {calc.calculationRun?.factorLibrary ? `${calc.calculationRun.factorLibrary.name} ${calc.calculationRun.factorLibrary.version}` : calc.factorLibraryVersion}
                  </p>
                  {calc.selectionReason ? <p className="mt-1 text-xs text-[#6B7280]">{calc.selectionReason}</p> : null}
                  {warnings.map((w) => (
                    <p key={w} className="mt-1 text-xs text-amber-800">{w}</p>
                  ))}
                </>
              ) : (
                <p className="text-xs text-[#6B7280]">Not calculated yet.</p>
              )}
            </section>
          ) : null}
          <div className="mt-auto flex gap-2">
            <Button asChild size="sm"><Link href={`/orgs/${orgId}/records/${recordId}`}>Open full record</Link></Button>
            <Dialog.Close asChild><Button type="button" variant="outline" size="sm">Close</Button></Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
