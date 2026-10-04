"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TextShimmer } from "@/components/ui/text-shimmer";

type Result = { sentences: string[]; ai: { text: string; provider: string } | null; aiNote: string | null };

/**
 * "Explain this change" under the waterfall: the plain account of what moved,
 * computed from the same figures, with an optional AI paragraph (only when the
 * organisation turned AI assistance on, labelled, and only when every figure
 * in it is one of the facts).
 */
export function ExplainChange({
  orgId,
  currentPeriodId,
  previousPeriodId,
  aiAvailable,
}: {
  orgId: string;
  currentPeriodId: string;
  previousPeriodId: string;
  aiAvailable: boolean;
}) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(ai: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/insights/explain-change`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPeriodId, previousPeriodId, ai }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      setError(b?.message ?? "Could not explain the change.");
      return;
    }
    setResult((await res.json()) as Result);
  }

  return (
    <div className="mt-3 rounded-[14px] border border-[#E5E7EB] bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => run(false)} disabled={busy}>Explain this change</Button>
        {result && aiAvailable && !result.ai ? (
          <Button type="button" size="sm" variant="outline" onClick={() => run(true)} disabled={busy}>Add AI wording</Button>
        ) : null}
        {busy ? <span role="status"><TextShimmer>Reading the figures</TextShimmer></span> : null}
      </div>
      {error ? <p role="alert" className="mt-2 text-red-700">{error}</p> : null}
      {result ? (
        <div className="mt-3 space-y-2 text-[#374151]">
          <p>{result.sentences.join(" ")}</p>
          {result.ai ? (
            <div>
              <p>{result.ai.text}</p>
              <p className="mt-1 text-xs text-[#6B7280]">AI-assisted wording. Every figure in it is one of the figures above; it cannot see causes, so treat the reasons as yours to check.</p>
            </div>
          ) : null}
          {result.aiNote ? <p className="text-xs text-[#6B7280]">{result.aiNote}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
