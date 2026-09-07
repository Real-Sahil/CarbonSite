"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type SigningMeta = {
  requestId: string;
  signatoryName: string;
  signatoryEmail: string;
  expiresAt: string | null;
  report: { id: string; type: string; organizationName: string };
};

type Phase = "loading" | "ready" | "submitting" | "done" | "error";

export default function SignPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<SigningMeta | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [outcome, setOutcome] = useState<"signed" | "declined" | null>(null);

  useEffect(() => {
    fetch(`/api/sign/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({ message: "Link not found or expired." }));
          throw new Error(j.message ?? "Invalid link.");
        }
        return res.json() as Promise<SigningMeta>;
      })
      .then((data) => { setMeta(data); setPhase("ready"); })
      .catch((e) => { setErrorMsg(e.message); setPhase("error"); });
  }, [token]);

  const act = async (action: "acknowledge" | "decline") => {
    setPhase("submitting");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message ?? "Request failed.");
      }
      setOutcome(action === "acknowledge" ? "signed" : "declined");
      setPhase("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Unexpected error.");
      setPhase("error");
    }
  };

  if (phase === "loading") return <Shell><Spinner /></Shell>;

  if (phase === "error") {
    return (
      <Shell>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">{errorMsg || "Something went wrong."}</p>
          <p className="mt-2 text-xs text-red-500">If this link was sent to you recently, contact the sender for a new one.</p>
        </div>
      </Shell>
    );
  }

  if (phase === "done" && outcome) {
    return (
      <Shell>
        <div className={`rounded-xl border p-8 text-center ${outcome === "signed" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`}>
          <div className="text-4xl mb-3">{outcome === "signed" ? "✓" : "–"}</div>
          <h2 className="text-xl font-semibold text-zinc-900">
            {outcome === "signed" ? "Acknowledgment recorded" : "Acknowledgment declined"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            {outcome === "signed"
              ? "Your acknowledgment has been cryptographically stamped into the report PDF and recorded in the audit log."
              : "Your response has been recorded. The sender has been notified."}
          </p>
        </div>
      </Shell>
    );
  }

  if (!meta) return null;

  const expiresAt = meta.expiresAt ? new Date(meta.expiresAt) : null;

  return (
    <Shell>
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">Acknowledgment Request</p>
        <h1 className="text-2xl font-bold text-zinc-900">{meta.report.organizationName}</h1>
        <p className="text-sm text-zinc-500 mt-1">Report type: <span className="font-medium text-zinc-700">{formatReportType(meta.report.type)}</span></p>
      </header>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 mb-6 text-sm space-y-1">
        <Row label="Addressed to" value={`${meta.signatoryName} (${meta.signatoryEmail})`} />
        <Row label="Report ID" value={meta.report.id} />
        {expiresAt && <Row label="Link expires" value={expiresAt.toLocaleString()} />}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6 text-sm text-amber-800">
        By clicking <strong>Acknowledge</strong>, you confirm that you have reviewed the above-referenced audit report in its entirety.
        Your name, email address, timestamp, and network address will be embedded in the signed PDF and recorded in the immutable audit log.
        This constitutes an electronic acknowledgment of review.
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => act("acknowledge")}
          disabled={phase === "submitting"}
          className="flex-1 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition-colors"
        >
          {phase === "submitting" ? "Processing..." : "Acknowledge"}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={phase === "submitting"}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          Decline
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="text-lg font-bold text-emerald-700">MetricOra</span>
          <span className="text-zinc-300">|</span>
          <span className="text-sm text-zinc-500">Secure document acknowledgment</span>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="font-medium text-zinc-800 text-right break-all">{value}</span>
    </div>
  );
}

function Spinner() {
  return <div className="h-8 w-8 mx-auto rounded-full border-2 border-zinc-200 border-t-emerald-600 animate-spin" />;
}

function formatReportType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
