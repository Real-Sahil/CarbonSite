"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A person asks the carrier for what its transfer note is missing. Sends only when they press Send. */
export function AskCarrier({ orgId, docId, missing, askedAt }: { orgId: string; docId: string; missing: string[]; askedAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/orgs/${orgId}/waste/documents/${docId}/ask-carrier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, ...(note.trim() && { note: note.trim() }) }),
    }).catch(() => null);
    const d = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setError(d?.message ?? "Could not send the email."); return; }
    setSent(true);
    setOpen(false);
    router.refresh();
  }

  if (missing.length === 0) return null;
  if (!open) {
    return (
      <div className="mt-1 space-y-0.5 text-xs">
        <button type="button" className="font-medium text-teal-700 underline underline-offset-2" onClick={() => { setOpen(true); setSent(false); }}>Ask the carrier</button>
        <div className="text-gray-500">Missing: {missing.join(", ")}</div>
        {(askedAt || sent) && <div className="text-gray-500">Asked {askedAt ? new Date(askedAt).toLocaleDateString("en-GB") : "just now"}</div>}
      </div>
    );
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mt-2 w-[min(420px,85vw)] space-y-2 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs">
      <p className="text-gray-700">Email the carrier asking for: <span className="font-medium">{missing.join(", ")}</span>. Their reply goes to your address.</p>
      <label className="grid gap-1 text-gray-700">
        Carrier&apos;s email
        <Input type="email" required value={to} onChange={(e) => setTo(e.target.value)} maxLength={200} />
      </label>
      <label className="grid gap-1 text-gray-700">
        Note (optional)
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
        <Button type="submit" size="sm" disabled={busy || !to}>{busy ? "Sending" : "Send email"}</Button>
      </div>
    </form>
  );
}
