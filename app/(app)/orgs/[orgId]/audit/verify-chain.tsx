"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChainResult {
  checkedAt: string;
  status: "empty" | "intact" | "broken";
  rows: number;
  verified: number;
  legacy: number;
  legacyLinkBreaks: number;
  headSeq: string | null;
  headHash: string | null;
  firstBreak?: { chainSeq: string; reason: "link" | "content" | "missing_hash" };
}

const REASON = {
  link: "does not follow the entry before it, so an entry was removed, added or moved",
  content: "was changed after it was recorded",
  missing_hash: "has no recorded hash",
} as const;

/** Recomputes every hash in the organisation's audit trail and says whether it is intact. */
export function VerifyChain({ orgId }: { orgId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChainResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${orgId}/audit-chain`);
      const body = (await res.json().catch(() => ({}))) as ChainResult & { message?: string };
      if (!res.ok) setError(body.message ?? "Could not check the audit trail.");
      else setResult(body);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-[65ch]">
          <h2 className="text-sm font-semibold text-[#111827]">Check the audit trail</h2>
          <p className="text-sm text-[#374151]">
            Each entry carries a hash of the entry before it, so a change, a removal or a reordering shows up. This recomputes every hash.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={check} disabled={busy}>
          {busy ? "Checking…" : "Check now"}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      {result && (
        <div role="status" className={`mt-3 rounded-md border p-3 text-sm ${result.status === "broken" ? "border-red-200 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {result.status === "broken" && result.firstBreak ? (
            <p>
              <strong>Not intact.</strong> Entry {result.firstBreak.chainSeq} {REASON[result.firstBreak.reason]}. Treat the trail as altered until this is explained.
            </p>
          ) : result.status === "empty" ? (
            <p>There are no entries to check yet.</p>
          ) : (
            <p>
              <strong>Intact.</strong> {result.rows.toLocaleString("en-GB")} entries checked: {result.verified.toLocaleString("en-GB")} recomputed and matching
              {result.legacy ? `, ${result.legacy.toLocaleString("en-GB")} older entries whose links were checked but whose contents cannot be recomputed` : ""}.
            </p>
          )}
          {result.headHash && (
            <p className="mt-1 break-all text-xs">
              Last entry {result.headSeq}, hash {result.headHash}. Removing the newest entries would leave a shorter chain that still checks, so keep a copy of this hash to compare with later.
            </p>
          )}
          <p className="mt-1 text-xs opacity-80">Checked {new Date(result.checkedAt).toLocaleString("en-GB")}.</p>
        </div>
      )}
    </div>
  );
}
