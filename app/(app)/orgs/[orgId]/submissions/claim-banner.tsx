"use client";

import { useState, useTransition } from "react";

const CLAIM_STALE_MS = 5 * 60 * 1000;

type Props = {
  orgId: string;
  submissionId: string;
  claimedBy: { id: string; name: string | null; email: string } | null;
  claimedAt: string | null;
};

export function SubmissionClaimBanner({ orgId, submissionId, claimedBy, claimedAt }: Props) {
  const [claimed, setClaimed] = useState(!!claimedBy);
  const [claimOwner, setClaimOwner] = useState(claimedBy);
  const [claimTime, setClaimTime] = useState(claimedAt ? new Date(claimedAt) : null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isStale = claimTime
    ? Date.now() - claimTime.getTime() > CLAIM_STALE_MS
    : true;

  async function handleClaim() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/field-submissions/${submissionId}/claim`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = await res.json();
        setClaimed(true);
        setClaimTime(new Date(data.reviewClaimedAt));
        setClaimOwner(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Could not claim submission.");
      }
    });
  }

  async function handleRelease() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/orgs/${orgId}/field-submissions/${submissionId}/claim`,
        { method: "DELETE" },
      );
      if (res.ok || res.status === 204) {
        setClaimed(false);
        setClaimTime(null);
        setClaimOwner(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Could not release claim.");
      }
    });
  }

  if (!claimed && !claimOwner) {
    return (
      <div className="mb-[21px] rounded-[14px] border border-[#E5E7EB] bg-[#f9fafb] px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-[#374151] tracking-[-0.36px]">
          Claim this submission to let other reviewers know you are working on it.
        </p>
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#111827] hover:bg-[#f0f9ff] transition-colors disabled:opacity-50"
        >
          {isPending ? "Claiming..." : "Claim"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="mb-[21px] rounded-[14px] border border-[#BAE6FD] bg-[#F0F9FF] px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-[#374151] tracking-[-0.36px]">
          You have claimed this submission for review.
        </p>
        <button
          onClick={handleRelease}
          disabled={isPending}
          className="shrink-0 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50"
        >
          {isPending ? "Releasing..." : "Release claim"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // Another reviewer has claimed it (and claim is fresh)
  if (claimOwner && !isStale) {
    return (
      <div className="mb-[21px] rounded-[14px] border border-amber-200 bg-amber-50 px-5 py-3 flex items-center justify-between gap-4">
        <p className="text-xs text-amber-900 tracking-[-0.36px]">
          <span className="font-medium">{claimOwner.name ?? claimOwner.email}</span> is currently
          reviewing this submission. Wait for them to finish or release their claim.
        </p>
        <button
          onClick={handleClaim}
          disabled={isPending}
          className="shrink-0 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors disabled:opacity-50"
        >
          {isPending ? "Claiming..." : "Override claim"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return null;
}
