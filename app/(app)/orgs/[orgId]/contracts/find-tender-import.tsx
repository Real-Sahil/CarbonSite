"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Draft = {
  name: string;
  clientName: string | null;
  contractValue: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  tenderReference: string | null;
  ftsNoticeId: string;
};
type Preview = {
  draft: Draft;
  warnings: string[];
  stage: "tender" | "award" | "other";
  suppliers: string[];
  noticeUrl: string;
  existingContract: { id: string; name: string } | null;
};

const field = "h-9 text-sm";
const label = "text-xs text-[#374151] tracking-[-0.36px]";

/** Contracts page: fill a contract from a Find a Tender notice, check it, then save. */
export function FindTenderImport({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function post(body: object) {
    return fetch(`/api/orgs/${orgId}/contracts/find-tender`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function lookUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const res = await post({ notice });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setPreview(null);
        setError(json?.message ?? "Could not read the notice.");
        return;
      }
      setPreview(json);
      setDraft(json.draft);
    });
  }

  function save() {
    if (!draft) return;
    setError(null);
    startTransition(async () => {
      const res = await post({
        notice: draft.ftsNoticeId,
        confirm: true,
        draft: {
          name: draft.name,
          clientName: draft.clientName,
          contractValue: draft.contractValue,
          currency: draft.currency,
          startDate: draft.startDate,
          endDate: draft.endDate,
        },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? "Could not create the contract.");
        return;
      }
      setSaved(json.contract.name);
      setPreview(null);
      setDraft(null);
      setNotice("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-[14px] border border-[#E5E7EB] p-[21px] flex flex-col gap-4">
      <div>
        <p className="text-sm font-normal text-[#111827] tracking-[-0.42px]">Import from Find a Tender</p>
        <p className="mt-1 text-xs text-[#6B7280]">
          Paste the notice number (for example 091200-2026) or its web address. An award notice gives the buyer, awarded value and dates.
        </p>
      </div>
      <form onSubmit={lookUp} className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <Label htmlFor="fts-notice" className={label}>Notice number or link</Label>
          <Input id="fts-notice" value={notice} onChange={(e) => setNotice(e.target.value)} placeholder="091200-2026" className={field} required />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={isPending || !notice.trim()}>
          {isPending && !preview ? "Reading notice…" : "Look up"}
        </Button>
      </form>

      {preview && draft && (
        <div className="flex flex-col gap-4 border-t border-[#E5E7EB] pt-4">
          <p className="text-xs text-[#6B7280]">
            {preview.stage === "award" ? "Award notice" : "Tender notice"} ·{" "}
            <a href={preview.noticeUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              View on Find a Tender
            </a>
            {preview.suppliers.length > 0 && <> · Supplier: {preview.suppliers.join(", ")}</>}
          </p>
          {preview.existingContract ? (
            <p className="text-sm text-amber-700">Already imported as &ldquo;{preview.existingContract.name}&rdquo;.</p>
          ) : (
            <>
              {preview.warnings.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {preview.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor="fts-name" className={label}>Name</Label>
                  <Input id="fts-name" value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fts-client" className={label}>Client (buyer)</Label>
                  <Input id="fts-client" value={draft.clientName ?? ""} maxLength={200} onChange={(e) => setDraft({ ...draft, clientName: e.target.value || null })} className={field} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fts-value" className={label}>Value ({draft.currency})</Label>
                  <Input
                    id="fts-value"
                    type="number"
                    min={0}
                    value={draft.contractValue ?? ""}
                    onChange={(e) => setDraft({ ...draft, contractValue: e.target.value === "" ? null : Number(e.target.value) })}
                    className={field}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fts-start" className={label}>Start date</Label>
                  <Input id="fts-start" type="date" value={draft.startDate ?? ""} onChange={(e) => setDraft({ ...draft, startDate: e.target.value || null })} className={field} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fts-end" className={label}>End date</Label>
                  <Input id="fts-end" type="date" value={draft.endDate ?? ""} onChange={(e) => setDraft({ ...draft, endDate: e.target.value || null })} className={field} />
                </div>
              </div>
              <p className="text-xs text-[#6B7280]">
                Reference: {draft.ftsNoticeId}
                {draft.tenderReference ? ` · Buyer's reference: ${draft.tenderReference}` : ""}
              </p>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={save} disabled={isPending || !draft.name.trim()}>
                  {isPending ? "Creating…" : "Create contract"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setPreview(null); setDraft(null); }} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {saved && <p className="text-xs text-green-700">Created &ldquo;{saved}&rdquo;.</p>}
    </div>
  );
}
